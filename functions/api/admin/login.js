// functions/api/admin/login.js — Reseller Admin Authentication API
import { initDb, getAdminPassword, getResellerApiKey, getMainApiUrl, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const password = (body.password || "").trim();
        const expectedPassword = await getAdminPassword(env);

        if (!expectedPassword) {
            return json({ success: false, error: "Store not configured yet. Please complete first-time setup.", needs_setup: true }, 400);
        }

        if (!password || password !== expectedPassword) {
            return json({ success: false, error: "Invalid admin password" }, 401);
        }

        // Fetch reseller live stats from Main Platform API using D1 key
        let resellerInfo = null;
        const apiKey = await getResellerApiKey(env);
        const mainApiUrl = await getMainApiUrl(env);

        if (apiKey) {
            try {
                const res = await fetch(`${mainApiUrl}/api/v1/me`, {
                    headers: { "X-API-Key": apiKey }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        resellerInfo = data.data;
                    }
                }
            } catch (_) {}
        }

        return json({
            success: true,
            message: "Login successful",
            token: btoa(password + ":" + Date.now()),
            reseller: resellerInfo || { username: "Reseller", credits: "N/A" }
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
