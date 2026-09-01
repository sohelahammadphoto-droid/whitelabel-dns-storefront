// functions/api/admin/login.js — Reseller Admin Authentication API
import { initDb, getAdminEmail, getAdminPassword, getResellerApiKey, getMainApiUrl, json, handleOptions, hashPassword } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const email = (body.email || "").trim().toLowerCase();
        const password = (body.password || "").trim();
        const expectedEmail = await getAdminEmail(env);
        const expectedPassword = await getAdminPassword(env);

        if (!expectedPassword) {
            return json({ success: false, error: "Store not configured yet. Please complete first-time setup.", needs_setup: true }, 400);
        }

        let isAuthorized = false;
        let adminRole = "superadmin";
        let staffName = "Store Admin";

        // 1. Check Superadmin credentials (matches admin_password and, if admin_email is configured, matches admin_email)
        if (password === expectedPassword && (!expectedEmail || !email || email === expectedEmail)) {
            isAuthorized = true;
        } else if (env.DB && email && password) {
            // 2. Check Staff / Sub-Reseller RBAC Table
            try {
                const passHash = await hashPassword(password);
                const staffUser = await env.DB.prepare("SELECT * FROM staff WHERE (username = ? OR username = ?) AND password_hash = ? AND status = 'active'")
                    .bind(email, email.split("@")[0], passHash).first();
                if (staffUser) {
                    isAuthorized = true;
                    adminRole = staffUser.role || "support";
                    staffName = staffUser.name || staffUser.username;
                }
            } catch (_) {}
        }

        if (!isAuthorized) {
            return json({ success: false, error: "Invalid admin email or password." }, 401);
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
