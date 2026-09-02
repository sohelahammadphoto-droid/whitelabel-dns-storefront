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
    const trxId = (paymentData.transaction_id || paymentData.invoice_id || "UDDOKTA-PAID").trim();
    const paymentMethod = paymentData.payment_method || "UddoktaPay";

    if (!orderId) {
        return { success: false, error: "Order ID missing" };
    }

    if (!env.DB) {
        return { success: false, error: "Database not configured" };
    }

    // Fetch order from D1
    const order = await env.DB.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first();
    if (!order) {
        return { success: false, error: `Order ${orderId} not found` };
    }

    // Idempotency: If already approved, return success
    if (order.status === "approved" && order.client_id) {
        return { success: true, message: "Order already provisioned", client_id: order.client_id };
    }

    // 🚀 Attempt Auto-Provisioning on Main Server
    const resellerApiKey = await getResellerApiKey(env);
    const mainApiUrl = await getMainApiUrl(env);

    let clientId = "";
    let dnsUrl = "";
    let expireDate = "";
    let autoProvisionSuccess = false;

    if (resellerApiKey) {
        try {
            const randSuffix = Math.floor(1000 + Math.random() * 9000);
            const cleanPhone = (order.customer_phone || "").replace(/\D/g, "").slice(-4);
            const suggestedUsername = `u${cleanPhone || randSuffix}`;

            const createRes = await fetch(`${mainApiUrl}/api/v1/client/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": resellerApiKey
                },
                body: JSON.stringify({
                    username: suggestedUsername,
                    duration_days: order.duration_days || 30,
                    phone: order.customer_phone || "",
                    note: `UddoktaPay (${orderId} - ${trxId})`
                })
            });

            const createData = await createRes.json();
            if (createRes.ok && createData.success && createData.data) {
                const client = createData.data;
                clientId = client.username || client.client_id || suggestedUsername;
                dnsUrl = client.dns_url || client.dot_host || client.dot_domain || client.android_dns || `${clientId}.dnsbd.pp.ua`;
                expireDate = client.expires_at || client.expire_date || "";
                autoProvisionSuccess = true;
            } else {
                console.warn("Main API auto-provision failed (e.g. low balance or offline):", createData);
            }
        } catch (err) {
            console.error("Error communicating with main API:", err);
        }
    }

    // Update Order in D1
    if (autoProvisionSuccess) {
        await env.DB.prepare(`
            UPDATE orders 
            SET status = 'approved',
                trx_id = ?,
                payment_method = ?,
                client_id = ?,
                dns_url = ?,
                expire_date = ?,
                admin_note = 'Instant Auto-Provisioned via UddoktaPay'
            WHERE order_id = ?
        `).bind(trxId, `UddoktaPay (${paymentMethod})`, clientId, dnsUrl, expireDate, orderId).run();
    } else {
        // Payment verified but manual provision needed (e.g. reseller out of credits / VPS offline)
        await env.DB.prepare(`
            UPDATE orders 
            SET status = 'paid_pending_provision',
                trx_id = ?,
                payment_method = ?,
                admin_note = 'Payment Completed via UddoktaPay. Manual DNS Key assignment needed.'
            WHERE order_id = ?
        `).bind(trxId, `UddoktaPay (${paymentMethod})`, orderId).run();
    }

    // 📢 Send Telegram Notification to Admin (AWAITED & HTML FORMATTED)
    try {
        const { token: botToken, chatId } = await getTelegramConfig(env);
        if (botToken && chatId) {
            const siteName = (await getSetting(env, "site_name", "UltraDNS Pro")) || "DNS Store";
            
            const teleMsg = autoProvisionSuccess ?
                `⚡ <b>NEW AUTO-PAID ORDER PROVISIONED!</b>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>\n` +
                `👤 <b>Customer:</b> ${escapeHtml(order.customer_name)} (<code>${escapeHtml(order.customer_phone)}</code>)\n` +
                `💳 <b>Method:</b> UddoktaPay (${escapeHtml(paymentMethod)})\n` +
                `📝 <b>TrxID:</b> <code>${escapeHtml(trxId)}</code>\n` +
                `💰 <b>Amount:</b> <b>${order.amount} ${escapeHtml(order.currency || 'BDT')}</b>\n` +
                `🔑 <b>DNS PIN:</b> <code>${escapeHtml(clientId)}</code>\n` +
                `🌐 <b>Host:</b> <code>${escapeHtml(dnsUrl)}</code>\n` +
                `⏳ <b>Expires:</b> ${escapeHtml(expireDate || 'Active')}\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🏪 <b>Store:</b> ${escapeHtml(siteName)}`
                :
                `⚠️ <b>AUTO-PAID ORDER RECEIVED (ACTION REQUIRED)</b>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>\n` +
                `👤 <b>Customer:</b> ${escapeHtml(order.customer_name)} (<code>${escapeHtml(order.customer_phone)}</code>)\n` +
                `💳 <b>Method:</b> UddoktaPay (${escapeHtml(paymentMethod)})\n` +
                `📝 <b>TrxID:</b> <code>${escapeHtml(trxId)}</code>\n` +
                `💰 <b>Amount:</b> <b>${order.amount} ${escapeHtml(order.currency || 'BDT')}</b>\n` +
                `📢 <b>Status:</b> <b>Payment Verified!</b> (VPS low credit / offline)\n` +
                `⚡ <i>Please click Approve in Admin Panel to issue DNS PIN.</i>\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🏪 <b>Store:</b> ${escapeHtml(siteName)}`;

            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
            const tgJson = await tgRes.json();
            if (!tgJson.ok) {
                console.error("Telegram delivery response:", tgJson);
            }
        }
    } catch (err) {
        console.error("Telegram alert error in _process.js:", err);
    }

    // Send Email Confirmation if configured
    if (order.customer_email && autoProvisionSuccess) {
        sendOrderApprovedEmail(env, order.customer_email, order.customer_name, {
            clientId: clientId,
            dnsUrl: dnsUrl,
            durationDays: order.duration_days || 30,
            expireDate: expireDate
        }).catch(() => {});
    }

    return {
        success: true,
        order_id: orderId,
        auto_provisioned: autoProvisionSuccess,
        status: autoProvisionSuccess ? 'approved' : 'paid_pending_provision',
        client_id: clientId,
        dns_url: dnsUrl
    };
}
