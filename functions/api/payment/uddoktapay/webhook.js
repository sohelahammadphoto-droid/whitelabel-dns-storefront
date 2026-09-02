// functions/api/payment/uddoktapay/webhook.js — IPN Webhook & Instant DNS Auto-Provisioning
import { initDb, getSetting, getResellerApiKey, getMainApiUrl, json, handleOptions } from "../../_db.js";
import { sendOrderApprovedEmail } from "../../_email.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestPost(context);
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const receivedKey = request.headers.get("RT-UDDOKTAPAY-API-KEY") || "";
        const storedApiKey = await getSetting(env, "uddoktapay_api_key", "");

        if (!storedApiKey || receivedKey !== storedApiKey) {
            console.warn("UddoktaPay Webhook Signature Mismatch!");
            return json({ success: false, error: "Unauthorized: Invalid API Key" }, 401);
        }

        const body = await request.json();
        console.log("UddoktaPay Webhook Received:", JSON.stringify(body));

        const status = String(body.status || "").toUpperCase();
        const metadata = body.metadata || {};
        const orderId = (metadata.order_id || body.order_id || "").trim();
        const trxId = (body.transaction_id || body.invoice_id || "UDDOKTA-AUTO").trim();
        const paymentMethod = body.payment_method || "UddoktaPay";

        if (!orderId) {
            return json({ success: false, error: "Order ID missing in metadata" }, 400);
        }

        if (status !== "COMPLETED") {
            console.log(`Payment status ${status} for order ${orderId}. Skipping auto-provisioning.`);
            return json({ success: true, message: `Status is ${status}, no action needed.` });
        }

        // Fetch Order from D1
        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first();
        if (!order) {
            return json({ success: false, error: "Order not found in database" }, 404);
        }

        // Idempotency: If already approved, do not double-provision
        if (order.status === "approved" && order.client_id) {
            return json({ success: true, message: "Order already processed and approved." });
        }

        // 🚀 Auto-Provision DNS Key on Main Platform API
        const resellerApiKey = await getResellerApiKey(env);
        const mainApiUrl = await getMainApiUrl(env);

        let clientId = "";
        let dnsUrl = "";
        let expireDate = "";
        let autoProvisionSuccess = false;

        if (resellerApiKey) {
            try {
                // Generate clean random username
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
                        note: `UddoktaPay Auto-Order (${orderId} - ${trxId})`
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
                    console.error("Main API auto-provision failed:", createData);
                }
            } catch (err) {
                console.error("Error calling main API for auto-provision:", err);
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
            // Payment verified but manual provision needed (e.g. reseller out of credits)
            await env.DB.prepare(`
                UPDATE orders 
                SET status = 'paid_pending_provision',
                    trx_id = ?,
                    payment_method = ?,
                    admin_note = 'Payment Completed via UddoktaPay. Manual DNS Key assignment needed.'
                WHERE order_id = ?
            `).bind(trxId, `UddoktaPay (${paymentMethod})`, orderId).run();
        }

        // Send Telegram Notification to Admin
        const botToken = await getSetting(env, "telegram_bot_token", "");
        const chatId = await getSetting(env, "telegram_chat_id", "");
        if (botToken && chatId) {
            const teleMsg = autoProvisionSuccess ?
                `⚡ *NEW AUTO-PAID ORDER PROVISIONED!*\n\n` +
                `📦 *Order ID:* \`${orderId}\`\n` +
                `👤 *Customer:* ${order.customer_name} (${order.customer_phone})\n` +
                `💳 *Method:* UddoktaPay (${paymentMethod})\n` +
                `💰 *Amount:* ${order.amount} ${order.currency}\n` +
                `🆔 *DNS PIN:* \`${clientId}\`\n` +
                `🌐 *Host:* \`${dnsUrl}\`\n` +
                `⏳ *Expires:* ${expireDate || 'Active'}`
                :
                `⚠️ *AUTO-PAID ORDER RECEIVED (CREDIT LOW)*\n\n` +
                `📦 *Order ID:* \`${orderId}\`\n` +
                `👤 *Customer:* ${order.customer_name} (${order.customer_phone})\n` +
                `💰 *Amount:* ${order.amount} ${order.currency}\n` +
                `💳 *Payment:* UddoktaPay (${trxId})\n` +
                `📢 *Action Required:* Please assign DNS PIN manually from Admin Panel.`;

            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: teleMsg, parse_mode: "Markdown" })
            }).catch(() => {});
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

        return json({
            success: true,
            message: "UddoktaPay webhook processed successfully!",
            auto_provisioned: autoProvisionSuccess,
            client_id: clientId
        });
    } catch (e) {
        console.error("Webhook exception:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
