// functions/api/order.js — Public & Authenticated Customer Order Submission API
import { initDb, verifyCustomerAuth, getAllSettings, json, handleOptions } from "./_db.js";
import { verifyAntiBot } from "./_antibot.js";

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestPost(context);
}

export async function onRequestOptions() {
    return handleOptions();
}

// Escape HTML special characters for Telegram HTML mode
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Helper to dynamically get Telegram configuration from D1 or Env
async function getTelegramConfig(env) {
    let token = "";
    let chatId = "";

    // 1. Direct D1 database lookup (Primary)
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
            console.error("D1 Telegram config lookup error:", e);
        }
    }

    // 2. Fallback to getAllSettings if direct lookup returned empty
    if (!token || !chatId) {
        try {
            const s = await getAllSettings(env);
            if (!token && s.telegram_bot_token) token = String(s.telegram_bot_token).replace(/^["']|["']$/g, "").trim();
            if (!chatId && s.telegram_chat_id) chatId = String(s.telegram_chat_id).replace(/^["']|["']$/g, "").trim();
        } catch (_) {}
    }

    // 3. Fallback to Cloudflare Pages Environment Variables if set
    if (!token && env.TELEGRAM_BOT_TOKEN) token = String(env.TELEGRAM_BOT_TOKEN).trim();
    if (!chatId && env.TELEGRAM_CHAT_ID) chatId = String(env.TELEGRAM_CHAT_ID).trim();

    return { token, chatId };
}

// Telegram alert helper
async function sendTelegramOrderAlert(env, orderData) {
    try {
        const { token, chatId } = await getTelegramConfig(env);

        if (!token || !chatId) {
            console.warn("Telegram order alert skipped: Bot Token or Chat ID not configured in settings.");
            return;
        }

        let siteName = "Private DNS Store";
        let siteUrl = "https://whitelabel-dns-storefront.pages.dev";
        if (env.DB) {
            try {
                const nameRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site_name'").first();
                if (nameRow && nameRow.value) {
                    siteName = String(nameRow.value).replace(/^["']|["']$/g, "").trim();
                }
                const urlRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'store_url'").first();
                if (urlRow && urlRow.value) {
                    siteUrl = String(urlRow.value).replace(/^["']|["']$/g, "").trim();
                }
            } catch (_) {}
        }

        const text = `🚨 <b>New Store Order Received!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 <b>Order ID:</b> <code>${escapeHtml(orderData.orderId)}</code>\n` +
            `👤 <b>Customer:</b> ${escapeHtml(orderData.customerName || 'N/A')}\n` +
            `📞 <b>Phone:</b> <code>${escapeHtml(orderData.customerPhone || 'N/A')}</code>\n` +
            `📧 <b>Email:</b> ${escapeHtml(orderData.finalEmail || 'N/A')}\n` +
            `📦 <b>Plan:</b> ${escapeHtml(orderData.planName || 'Standard Pass')} (${orderData.durationDays || 30} Days)\n` +
            `💰 <b>Amount:</b> <b>${orderData.finalAmount} ${escapeHtml(orderData.currency || 'SAR')}</b>\n` +
            `💳 <b>Method:</b> ${escapeHtml(orderData.paymentMethod || 'Manual')}\n` +
            `📝 <b>TrxID:</b> <code>${escapeHtml(orderData.trxId || 'N/A')}</code>\n` +
            (orderData.couponCode ? `🎟️ <b>Coupon:</b> <code>${escapeHtml(orderData.couponCode)}</code> (Saved ${orderData.discountAmount} ${escapeHtml(orderData.currency || 'SAR')})\n` : '') +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🌐 <b>Website:</b> <a href="${siteUrl}">${escapeHtml(siteName)} ↗</a>\n` +
            `⚙️ <b>Admin Panel:</b> <a href="${siteUrl}/admin.html">Open Admin Dashboard ↗</a>\n` +
            `🧾 <b>Invoice:</b> <a href="${siteUrl}/api/invoice?id=${encodeURIComponent(orderData.orderId)}">View Official Receipt ↗</a>`;

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "ResellerStorefront/1.0"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "HTML"
            })
        });

        // Fail-safe fallback: If Telegram returns an error on HTML mode, resend with plain text
        if (!tgRes.ok) {
            const errData = await tgRes.json().catch(() => ({}));
            console.error("Telegram HTML send failed, trying plain text fallback:", errData);

            const plainText = `🚨 New Store Order Received!\n` +
                `Order ID: ${orderData.orderId}\n` +
                `Customer: ${orderData.customerName || 'N/A'}\n` +
                `Phone: ${orderData.customerPhone || 'N/A'}\n` +
                `Email: ${orderData.finalEmail || 'N/A'}\n` +
                `Plan: ${orderData.planName} (${orderData.durationDays} Days)\n` +
                `Amount: ${orderData.finalAmount} ${orderData.currency}\n` +
                `Method: ${orderData.paymentMethod}\n` +
                `TrxID: ${orderData.trxId}\n` +
                `Store: ${siteName}\n` +
                `Login to Store Admin to approve.`;

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "ResellerStorefront/1.0"
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: plainText
                })
            });
        }
    } catch (err) {
        console.error("Telegram alert error in order.js:", err);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();

        // 🛡️ Invisible Anti-Bot & Anti-Scraping Check
        const antiBot = await verifyAntiBot(request, body, env);
        if (!antiBot.ok) {
            return json({ success: false, error: antiBot.error }, antiBot.status || 400);
        }
        const customerName = (body.customer_name || "").trim();
        const customerPhone = (body.customer_phone || "").trim();
        const customerEmail = (body.customer_email || "").trim().toLowerCase();
        const planId = (body.plan_id || "").trim();
        const paymentMethod = (body.payment_method || "").trim();
        const trxId = (body.trx_id || "").trim();
        const couponCode = (body.coupon_code || "").trim().toUpperCase();

        if (!customerName || !customerPhone || !planId || !paymentMethod || !trxId) {
            return json({ success: false, error: "Please fill in all required fields (Name, Phone, Plan, Payment Method, Transaction ID)" }, 400);
        }

        // Check if customer is logged in
        let customerId = null;
        let finalEmail = customerEmail;
        const loggedInUser = await verifyCustomerAuth(request, env);
        if (loggedInUser) {
            customerId = loggedInUser.id;
            finalEmail = loggedInUser.email;
        }

        // Map plan details from body or fallback
        const durationDays = parseInt(body.duration_days, 10) || 30;
        const planName = (body.plan_name || `${durationDays} Days Pass`).trim();
        let baseAmount = parseFloat(body.amount) || 15;
        let discountAmount = 0;
        let finalAmount = baseAmount;
        const currency = (body.currency || env.CURRENCY || "SAR").trim();

        // Validate coupon if provided
        if (couponCode && env.DB) {
            const coupon = await env.DB.prepare(
                "SELECT * FROM coupons WHERE UPPER(code) = ? AND status = 'active'"
            ).bind(couponCode).first();

            if (coupon) {
                const now = Date.now();
                const expOk = !coupon.expires_at || now <= new Date(coupon.expires_at).getTime();
                const usesOk = coupon.max_uses <= 0 || coupon.used_count < coupon.max_uses;
                const minOk = coupon.min_amount <= 0 || baseAmount >= coupon.min_amount;

                if (expOk && usesOk && minOk) {
                    if (coupon.discount_type === "percent") {
                        discountAmount = (baseAmount * coupon.discount_val) / 100;
                    } else {
                        discountAmount = coupon.discount_val;
                    }
                    discountAmount = Math.min(discountAmount, baseAmount);
                    finalAmount = Math.max(0, baseAmount - discountAmount);

                    // Increment coupon use
                    await env.DB.prepare(
                        "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?"
                    ).bind(coupon.id).run();
                }
            }
        }

        const orderId = "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        if (env.DB) {
            await env.DB.prepare(`
                INSERT INTO orders (
                    order_id, customer_id, customer_name, customer_phone, customer_email,
                    plan_id, plan_name, duration_days, amount, currency,
                    payment_method, trx_id, status, admin_note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            `).bind(
                orderId, customerId, customerName, customerPhone, finalEmail,
                planId, planName, durationDays, finalAmount, currency,
                paymentMethod, trxId, couponCode ? `Coupon applied: ${couponCode}` : null
            ).run();
        }

        // Send Telegram notification
        try {
            await sendTelegramOrderAlert(env, {
                orderId, customerName, customerPhone, finalEmail, planName, durationDays,
                finalAmount, currency, paymentMethod, trxId, couponCode, discountAmount
            });
        } catch (_) {}

        return json({
            success: true,
            message: "Order submitted successfully! Your DNS code will be activated once payment is verified.",
            data: {
                order_id: orderId,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: finalEmail,
                plan_name: planName,
                amount: finalAmount,
                discount: discountAmount,
                currency: currency,
                status: "pending"
            }
        });
    } catch (e) {
        console.error("Order error:", e);
        return json({ success: false, error: "Failed to process order: " + e.message }, 500);
    }
}
