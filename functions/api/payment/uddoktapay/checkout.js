// functions/api/payment/uddoktapay/checkout.js — Automated Checkout Session Initializer
import { initDb, getSetting, getAllSettings, verifyCustomerAuth, json, handleOptions } from "../../_db.js";
import { verifyAntiBot } from "../../_antibot.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestPost(context);
}

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
            console.error("D1 Telegram config error in checkout.js:", e);
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

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const body = await request.json();

        // 🛡️ Invisible Anti-Bot & Anti-Scraping Check
        const antiBot = await verifyAntiBot(request, body, env);
        if (!antiBot.ok) {
            return json({ success: false, error: antiBot.error }, antiBot.status || 400);
        }

        // Check if UddoktaPay is enabled and configured
        const isEnabled = await getSetting(env, "uddoktapay_enabled", false);
        const apiKey = await getSetting(env, "uddoktapay_api_key", "");
        let baseUrl = (await getSetting(env, "uddoktapay_base_url", "") || "").trim();

        if (!isEnabled || !apiKey || !baseUrl) {
            return json({ success: false, error: "Automated payment gateway is currently unavailable. Please choose manual payment or contact support." }, 400);
        }

        // Sanitize Base URL (handles root domain, /api, /api/checkout, or /api/checkout-v2)
        baseUrl = baseUrl.replace(/\/+$/, "")
                         .replace(/\/api\/checkout-v2\/?$/i, "")
                         .replace(/\/api\/checkout\/?$/i, "")
                         .replace(/\/api\/?$/i, "");

        const customerName = (body.customer_name || "Valued Customer").trim();
        const customerPhone = (body.customer_phone || "").trim();
        const customerEmail = (body.customer_email || "").trim().toLowerCase();
        const planId = (body.plan_id || "1m").trim();
        const planName = (body.plan_name || "Private DNS Pass").trim();
        const durationDays = parseInt(body.duration_days || 30, 10);
        const amount = parseFloat(body.amount || 0);
        const currency = (body.currency || "BDT").trim();
        const couponCode = (body.coupon_code || "").trim();

        if (!customerName || !customerPhone) {
            return json({ success: false, error: "Name and phone number are required to create your DNS subscription." }, 400);
        }

        if (amount <= 0) {
            return json({ success: false, error: "Invalid payment amount." }, 400);
        }

        // Optional customer auth association
        let customerId = null;
        const loggedCustomer = await verifyCustomerAuth(request, env);
        if (loggedCustomer) {
            customerId = loggedCustomer.id;
        }

        // Generate unique Order ID (ORD-XXXXXX)
        const randId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const orderId = `ORD-${randId}`;

        // Create pending order in D1
        await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_id, customer_name, customer_phone, customer_email,
                plan_id, plan_name, duration_days, amount, currency,
                payment_method, trx_id, status, admin_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UddoktaPay (Auto)', 'PENDING-AUTO', 'pending', ?)
        `).bind(
            orderId, customerId, customerName, customerPhone, customerEmail,
            planId, planName, durationDays, amount, currency,
            couponCode ? `Coupon: ${couponCode}` : 'Awaiting UddoktaPay Confirmation'
        ).run();

        // 📢 Send immediate Telegram notification for the new order initiation (Awaited HTML)
        try {
            const { token: botToken, chatId } = await getTelegramConfig(env);
            if (botToken && chatId) {
                const siteName = (await getSetting(env, "site_name", "UltraDNS Pro")) || "DNS Store";
                const teleMsg = `🚨 <b>New Store Order Initiated!</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>\n` +
                    `👤 <b>Customer:</b> ${escapeHtml(customerName)}\n` +
                    `📞 <b>Phone:</b> <code>${escapeHtml(customerPhone)}</code>\n` +
                    (customerEmail ? `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` : '') +
                    `📦 <b>Plan:</b> ${escapeHtml(planName)} (${durationDays} Days)\n` +
                    `💰 <b>Amount:</b> <b>${amount} ${escapeHtml(currency)}</b>\n` +
                    `💳 <b>Method:</b> UddoktaPay (Auto Checkout)\n` +
                    (couponCode ? `🎟️ <b>Coupon:</b> <code>${escapeHtml(couponCode)}</code>\n` : '') +
                    `━━━━━━━━━━━━━━━━━━━\n` +
                    `🏪 <b>Store:</b> ${escapeHtml(siteName)}\n` +
                    `⏳ <i>Customer redirected to payment gateway...</i>`;

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
        } catch (tgErr) {
            console.error("Telegram initial order notification error:", tgErr);
        }

        // Prepare UddoktaPay Checkout Payload
        const urlObj = new URL(request.url);
        const origin = `${urlObj.protocol}//${urlObj.host}`;

        const uddoktaPayload = {
            full_name: customerName,
            email: customerEmail || "customer@dnsstore.com",
            amount: amount,
            metadata: {
                order_id: orderId,
                plan_id: planId,
                plan_name: planName,
                duration_days: durationDays,
                customer_phone: customerPhone,
                customer_id: customerId || ""
            },
            redirect_url: `${origin}/api/payment/uddoktapay/return?order_id=${encodeURIComponent(orderId)}`,
            cancel_url: `${origin}/#plans`,
            webhook_url: `${origin}/api/payment/uddoktapay/webhook`
        };

        const checkoutEndpoint = `${baseUrl}/api/checkout-v2`;
        const res = await fetch(checkoutEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RT-UDDOKTAPAY-API-KEY": apiKey
            },
            body: JSON.stringify(uddoktaPayload)
        });

        const data = await res.json();

        if (data.status && data.payment_url) {
            return json({
                success: true,
                order_id: orderId,
                payment_url: data.payment_url,
                message: "Payment session created. Redirecting to payment gateway..."
            });
        } else {
            console.error("UddoktaPay API Error:", data);
            return json({
                success: false,
                error: data.message || "Failed to initialize automated payment. Please try manual payment."
            }, 400);
        }
    } catch (e) {
        console.error("UddoktaPay Checkout error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
