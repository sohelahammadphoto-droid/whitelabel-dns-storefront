// functions/api/admin/generate.js — Manual Direct DNS Generation for Reseller
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
        const phone = (body.phone || "").trim();
        const durationDays = parseInt(body.duration_days, 10) || 30;
        const note = (body.note || "Direct Store Admin Creation").trim();

        const apiKey = await getResellerApiKey(env);
        const mainApiUrl = await getMainApiUrl(env);

        if (!apiKey) {
            return json({ success: false, error: "Reseller API Key is not configured. Please enter your API key in Admin -> Store Settings." }, 400);
        }

        // Always enforce standard random client PIN (e.g. u + 6 random alphanumeric)
        const randChars = Math.random().toString(36).substring(2, 8).toLowerCase();
        const autoUsername = `u${randChars}`;

        const apiRes = await fetch(`${mainApiUrl}/api/v1/client/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey
            },
            body: JSON.stringify({
                username: autoUsername,
                phone: phone,
                duration_days: durationDays,
                note: note
            })
        });

        const apiData = await apiRes.json();

        if (!apiRes.ok || !apiData.success) {
            return json({
                success: false,
                error: apiData.error || "Failed to create client",
                details: apiData
            }, 400);
        }

        const client = apiData.data || {};
        const clientId = client.client_id || client.username || autoUsername;
        const dnsUrl = client.dot_domain || `${clientId}.dns.sohel.pp.ua`;
        const expireDate = client.expires_at || client.expire_date || "";

        // Record in D1 if available
        if (env.DB) {
            const orderId = "MAN-" + Math.random().toString(36).substring(2, 8).toUpperCase();
            await env.DB.prepare(`
                INSERT INTO orders (
                    order_id, customer_name, customer_phone, plan_id, plan_name,
                    duration_days, amount, currency, payment_method, trx_id, status,
                    client_id, dns_url, expire_date, admin_note
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 'SAR', 'Manual Admin', 'DIRECT-GEN', 'approved', ?, ?, ?, ?)
            `).bind(
                orderId, autoUsername, phone, "custom", `${durationDays} Days Plan`,
                durationDays, clientId, dnsUrl, expireDate, note
            ).run();
        }

        return json({
            success: true,
            message: "DNS PIN generated successfully!",
            data: {
                client_id: clientId,
                dns_url: dnsUrl,
                expire_date: expireDate,
                duration_days: durationDays
            }
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
