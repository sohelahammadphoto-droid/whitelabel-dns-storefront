// functions/api/payment/uddoktapay/_process.js — Shared Order Provisioning & Status Handler
import { getSetting, getAllSettings, getResellerApiKey, getMainApiUrl } from "../../_db.js";
import { sendOrderApprovedEmail } from "../../_email.js";

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function getTelegramConfig(env) {
    let token = "";
    let chatId = "";

    if (env.DB) {
        try {
            const tokenRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").first();
            if (tokenRow && tokenRow.value) {
                token = String(tokenRow.value).replace(/^["']|["']$/g, "").trim();
            }
            const chatRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
            if (chatRow && chatRow.value) {
                chatId = String(chatRow.value).replace(/^["']|["']$/g, "").trim();
            }
        } catch (e) {
            console.error("D1 Telegram config error:", e);
        }
    }

    if (!token || !chatId) {
        try {
            const s = await getAllSettings(env);
            if (!token && s.telegram_bot_token) token = String(s.telegram_bot_token).replace(/^["']|["']$/g, "").trim();
            if (!chatId && s.telegram_chat_id) chatId = String(s.telegram_chat_id).replace(/^["']|["']$/g, "").trim();
        } catch (_) {}
    }

    if (!token && env.TELEGRAM_BOT_TOKEN) token = String(env.TELEGRAM_BOT_TOKEN).trim();
    if (!chatId && env.TELEGRAM_CHAT_ID) chatId = String(env.TELEGRAM_CHAT_ID).trim();

    return { token, chatId };
}

export async function processCompletedPayment(env, paymentData) {
    const metadata = paymentData.metadata || {};
    const orderId = (metadata.order_id || paymentData.order_id || "").trim();
    const customerName = (metadata.customer_name || paymentData.full_name || paymentData.name || "Valued Customer").trim();
    const customerPhone = (metadata.customer_phone || paymentData.phone_number || "").trim();
    const customerEmail = (metadata.customer_email || paymentData.email || "").trim().toLowerCase();
    const customerId = metadata.customer_id ? parseInt(metadata.customer_id, 10) : null;
    const planId = (metadata.plan_id || "1m").trim();
    const planName = (metadata.plan_name || "Private DNS Pass").trim();
    const durationDays = parseInt(metadata.duration_days || 30, 10);
    const amount = parseFloat(metadata.amount || paymentData.amount || 0);
    const currency = (metadata.currency || "BDT").trim();
    const couponCode = (metadata.coupon_code || "").trim();
    const trxId = (paymentData.transaction_id || paymentData.invoice_id || "UDDOKTA-PAID").trim();
    const paymentMethod = paymentData.payment_method || "UddoktaPay";

    if (!orderId) {
        return { success: false, error: "Order ID missing" };
    }

    if (!env.DB) {
        return { success: false, error: "Database not configured" };
    }

    // Check if order already exists in D1
    const existingOrder = await env.DB.prepare("SELECT * FROM orders WHERE order_id = ? OR trx_id = ?").bind(orderId, trxId).first();
    
    // Idempotency: If already approved and has DNS PIN, do not re-provision
    if (existingOrder && existingOrder.status === "approved" && existingOrder.client_id) {
        return { success: true, message: "Order already provisioned", client_id: existingOrder.client_id };
    }

    // 🚀 Attempt Auto-Provisioning on Main Server
    const resellerApiKey = await getResellerApiKey(env);
    const mainApiUrl = await getMainApiUrl(env);

    let clientId = "";
    let dnsUrl = "";
    let expireDate = "";
    let autoProvisionSuccess = false;

    if (resellerApiKey) {
        // Try up to 3 times in case of extreme duplicate collision
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Standard format: u + 7-digit random number (e.g. u7492810)
                const rand7 = Math.floor(1000000 + Math.random() * 9000000);
                const suggestedUsername = `u${rand7}`;

                const createRes = await fetch(`${mainApiUrl}/api/v1/client/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": resellerApiKey
                    },
                    body: JSON.stringify({
                        username: suggestedUsername,
                        duration_days: durationDays,
                        phone: customerPhone,
                        note: `AutoOrder (${orderId} - ${trxId})`
                    })
                });

                const createData = await createRes.json();
                if (createRes.ok && createData.success && createData.data) {
                    const client = createData.data;
                    clientId = client.username || client.client_id || suggestedUsername;
                    dnsUrl = client.dns_url || client.dot_host || client.dot_domain || client.android_dns || `${clientId}.dnsbd.pp.ua`;
                    expireDate = client.expires_at || client.expire_date || "";
                    autoProvisionSuccess = true;
                    break; // Successfully created
                } else if (createRes.status === 409) {
                    console.warn(`Username ${suggestedUsername} already taken, retrying next random PIN (Attempt ${attempt}/3)...`);
                    continue; // Retry with new random number
                } else {
                    console.warn("Main API auto-provision failed (e.g. low balance or offline):", createData);
                    break;
                }
            } catch (err) {
                console.error("Error communicating with main API:", err);
                break;
            }
        }
    }

    const finalStatus = autoProvisionSuccess ? 'approved' : 'paid_pending_provision';
    const adminNote = autoProvisionSuccess ? 
        'Instant Auto-Provisioned via UddoktaPay' : 
        'Payment Completed via UddoktaPay. Manual DNS Key assignment needed.';

    // Save into D1 (Insert new or Update existing)
    if (existingOrder) {
        await env.DB.prepare(`
            UPDATE orders 
            SET status = ?,
                trx_id = ?,
                payment_method = ?,
                client_id = ?,
                dns_url = ?,
                expire_date = ?,
                admin_note = ?
            WHERE order_id = ?
        `).bind(finalStatus, trxId, `UddoktaPay (${paymentMethod})`, clientId, dnsUrl, expireDate, adminNote, existingOrder.order_id).run();
    } else {
        await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_id, customer_name, customer_phone, customer_email,
                plan_id, plan_name, duration_days, amount, currency,
                payment_method, trx_id, status, client_id, dns_url, expire_date, admin_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            orderId, customerId, customerName, customerPhone, customerEmail,
            planId, planName, durationDays, amount, currency,
            `UddoktaPay (${paymentMethod})`, trxId, finalStatus, clientId, dnsUrl, expireDate, adminNote
        ).run();
    }

    // 📢 Send Telegram Notification to Admin (AWAITED & HTML FORMATTED)
    try {
        const { token: botToken, chatId } = await getTelegramConfig(env);
        if (botToken && chatId) {
            const siteName = (await getSetting(env, "site_name", "UltraDNS Pro")) || "DNS Store";
            const siteUrl = (await getSetting(env, "store_url", "")) || "https://whitelabel-dns-storefront.pages.dev";
            
            const teleMsg = autoProvisionSuccess ?
                `⚡ <b>NEW AUTO-PAID ORDER PROVISIONED!</b>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>\n` +
                `👤 <b>Customer:</b> ${escapeHtml(customerName)} (<code>${escapeHtml(customerPhone)}</code>)\n` +
                `💳 <b>Method:</b> ${escapeHtml(paymentMethod)}\n` +
                `📝 <b>TrxID:</b> <code>${escapeHtml(trxId)}</code>\n` +
                `💰 <b>Amount:</b> <b>${amount} ${escapeHtml(currency)}</b>\n` +
                `🔑 <b>DNS PIN:</b> <code>${escapeHtml(clientId)}</code>\n` +
                `🌐 <b>Host:</b> <code>${escapeHtml(dnsUrl)}</code>\n` +
                `⏳ <b>Expires:</b> ${escapeHtml(expireDate || 'Active')}\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <b>Website:</b> <a href="${siteUrl}">${escapeHtml(siteName)} ↗</a>\n` +
                `🧾 <b>Invoice:</b> <a href="${siteUrl}/api/invoice?id=${encodeURIComponent(orderId)}">View Official Receipt ↗</a>`
                :
                `⚠️ <b>AUTO-PAID ORDER RECEIVED (ACTION REQUIRED)</b>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>\n` +
                `👤 <b>Customer:</b> ${escapeHtml(customerName)} (<code>${escapeHtml(customerPhone)}</code>)\n` +
                `💳 <b>Method:</b> ${escapeHtml(paymentMethod)}\n` +
                `📝 <b>TrxID:</b> <code>${escapeHtml(trxId)}</code>\n` +
                `💰 <b>Amount:</b> <b>${amount} ${escapeHtml(currency)}</b>\n` +
                `📢 <b>Status:</b> <b>Payment Verified!</b> (VPS low credit / offline)\n` +
                `⚡ <i>Please click Approve in Admin Panel to issue DNS PIN.</i>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <b>Website:</b> <a href="${siteUrl}">${escapeHtml(siteName)} ↗</a>\n` +
                `⚙️ <b>Admin Panel:</b> <a href="${siteUrl}/admin.html">Open Admin Dashboard ↗</a>\n` +
                `🧾 <b>Invoice:</b> <a href="${siteUrl}/api/invoice?id=${encodeURIComponent(orderId)}">View Official Receipt ↗</a>`;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "ResellerStorefront/1.0"
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: teleMsg,
                    parse_mode: "HTML"
                })
            });
        }
    } catch (err) {
        console.error("Telegram alert error in _process.js:", err);
    }

    // Send Email Confirmation if configured
    if (customerEmail && autoProvisionSuccess) {
        sendOrderApprovedEmail(env, customerEmail, customerName, {
            clientId: clientId,
            dnsUrl: dnsUrl,
            durationDays: durationDays,
            expireDate: expireDate
        }).catch(() => {});
    }

    return {
        success: true,
        order_id: orderId,
        auto_provisioned: autoProvisionSuccess,
        status: finalStatus,
        client_id: clientId,
        dns_url: dnsUrl
    };
}
