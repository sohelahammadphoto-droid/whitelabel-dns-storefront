// functions/api/admin/login.js — Reseller Admin Authentication API
import { initDb, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const password = (body.password || "").trim();
        const expectedPassword = (env.ADMIN_PASSWORD || "admin123").trim();

        if (!password || password !== expectedPassword) {
            return json({ success: false, error: "Invalid admin password" }, 401);
        }

        // Fetch reseller live stats from Main Platform API if RESELLER_API_KEY is present
        let resellerInfo = null;
        const apiKey = (env.RESELLER_API_KEY || "").trim();
        const mainApiUrl = (env.MAIN_API_URL || "https://dnshub.pages.dev").trim();

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
