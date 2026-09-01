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
                data: {
                    credits: 0,
                    test_pins: 0,
                    test_credits: 0
                },
                credits: 0,
                test_credits: 0,
                test_pins: 0,
                message: "Reseller API Key is not configured yet. Go to Settings -> Store & API Settings to enter it."
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
        const reseller = data.data || data.reseller || data || {};

        const credits = reseller.credits !== undefined ? reseller.credits : (reseller.balance !== undefined ? reseller.balance : 0);
        const testCredits = reseller.test_credits !== undefined ? reseller.test_credits : (reseller.test_pins !== undefined ? reseller.test_pins : (reseller.remaining_test_credits !== undefined ? reseller.remaining_test_credits : 0));

        return json({
            success: true,
            configured: true,
            data: {
                username: reseller.username || "Reseller",
                credits: credits,
                test_pins: testCredits,
                test_credits: testCredits,
                stats: reseller.stats || {}
            },
            username: reseller.username,
            credits: credits,
            test_credits: testCredits,
            test_pins: testCredits,
            stats: reseller.stats || {}
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
