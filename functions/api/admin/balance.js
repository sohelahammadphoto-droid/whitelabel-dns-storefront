// functions/api/admin/balance.js — Live Reseller API Balance & Test Credits Endpoint
import { initDb, verifyAuth, getResellerApiKey, getMainApiUrl, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const apiKey = await getResellerApiKey(env);
        const mainApiUrl = await getMainApiUrl(env);

        if (!apiKey) {
            return json({
                success: true,
                configured: false,
                credits: 0,
                test_credits: 0,
                message: "API Key not configured"
            });
        }

        const res = await fetch(`${mainApiUrl}/api/v1/me`, {
            headers: { "X-API-Key": apiKey }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return json({
                success: false,
                configured: true,
                error: errData.error || "Failed to fetch balance from Main API"
            }, res.status);
        }

        const data = await res.json();
        const reseller = data.data || {};

        return json({
            success: true,
            configured: true,
            username: reseller.username,
            credits: reseller.credits !== undefined ? reseller.credits : 0,
            test_credits: reseller.test_credits !== undefined ? reseller.test_credits : 0,
            stats: reseller.stats || {}
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
