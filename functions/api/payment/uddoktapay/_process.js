// functions/api/payment/uddoktapay/_process.js — Shared Order Provisioning & Status Handler
import { getSetting, getResellerApiKey, getMainApiUrl } from "../../_db.js";
import { sendOrderApprovedEmail } from "../../_email.js";

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
                console.warn("Main API auto-provision failed (likely low balance/credit):", createData);
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

    // Send Telegram Notification to Admin
    try {
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
                `⚠️ *AUTO-PAID ORDER RECEIVED (CREDIT LOW / ACTION NEEDED)*\n\n` +
                `📦 *Order ID:* \`${orderId}\`\n` +
                `👤 *Customer:* ${order.customer_name} (${order.customer_phone})\n` +
                `💰 *Amount:* ${order.amount} ${order.currency}\n` +
                `💳 *Payment:* UddoktaPay (${trxId})\n` +
                `📢 *Action Required:* Please assign DNS PIN from Admin Panel.`;

            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: teleMsg, parse_mode: "Markdown" })
            }).catch(() => {});
        }
    } catch (_) {}

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
