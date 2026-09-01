// functions/api/admin/test-pin.js — 30-Minute Test PIN Generator for Store Admin
import { initDb, verifyAuth, getResellerApiKey, getMainApiUrl, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const body = await request.json();
        const username = (body.username || "").trim().toLowerCase();
        const phone = (body.phone || "").trim();
        const note = (body.note || "Store Admin 30-Min Trial").trim();

        const apiKey = await getResellerApiKey(env);
        const mainApiUrl = await getMainApiUrl(env);

        if (!apiKey) {
            return json({ success: false, error: "Reseller API Key is not configured. Please enter your API key in Admin -> Store Settings." }, 400);
        }

        // Always enforce standard random test PIN (testXXXX)
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const autoUsername = `test${randSuffix}`;

        const apiRes = await fetch(`${mainApiUrl}/api/v1/client/test-pin`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey
            },
            body: JSON.stringify({
                username: autoUsername,
                phone: phone,
                note: note
            })
        });

        const apiData = await apiRes.json();

        if (!apiRes.ok || !apiData.success) {
            return json({
                success: false,
                error: apiData.error || "Failed to create Test PIN",
                details: apiData
            }, apiRes.status || 400);
        }

        const client = apiData.data || {};
        const clientId = client.username || client.client_id || autoUsername;
        const dnsUrl = client.dns_url || client.dot_host || client.dot_domain || client.android_dns || `${clientId}.dnsbd.pp.ua`;
        const expireDate = client.expires_at || client.expire_date || "";

        // Record in D1 if available
        if (env.DB) {
            const orderId = "TEST-" + Math.random().toString(36).substring(2, 8).toUpperCase();
            await env.DB.prepare(`
                INSERT INTO orders (
                    order_id, customer_name, customer_phone, plan_id, plan_name,
                    duration_days, amount, currency, payment_method, trx_id, status,
                    client_id, dns_url, expire_date, admin_note
                ) VALUES (?, ?, ?, 'test_30m', '30-Minute Trial PIN', 0, 0, 'SAR', 'Test PIN', 'TEST-TRIAL', 'approved', ?, ?, ?, ?)
            `).bind(
                orderId, autoUsername, phone || "N/A", clientId, dnsUrl, expireDate, note
            ).run();
        }

        return json({
            success: true,
            message: apiData.message || "30-Minute Test PIN generated successfully!",
            data: {
                username: clientId,
                client_id: clientId,
                dns_url: dnsUrl,
                duration_minutes: 30,
                expires_at: expireDate,
                remaining_test_credits: client.remaining_test_credits !== undefined ? client.remaining_test_credits : null,
                whatsapp_share_text: client.whatsapp_share_text || `⚡ *30-MIN PRIVATE DNS TEST PIN*\n\n👤 *Username:* \`${clientId}\`\n⏱️ *Duration:* 30 Minutes\n🌐 *DNS Hostname:* \`${dnsUrl}\`\n\n📲 *Android:* Settings ➔ Connections ➔ Private DNS ➔ \`${dnsUrl}\``,
                ios_profile_url: client.ios_profile_url || ""
            }
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
