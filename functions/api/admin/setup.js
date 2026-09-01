// functions/api/admin/setup.js — First-Time Store Setup Wizard API
import { initDb, getAdminPassword, setSetting, getAllSettings, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: Check if store is already initialized or needs first-time setup
export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    const existingPassword = await getAdminPassword(env);
    const hasDatabase = !!env.DB;

    return json({
        success: true,
        needsSetup: !existingPassword,
        needs_setup: !existingPassword,
        has_database: hasDatabase
    });
}

// POST: Perform First-Time Setup Wizard
export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "D1 Database binding 'DB' is missing in Cloudflare Pages." }, 500);
    }

    try {
        const existingPassword = await getAdminPassword(env);
        const body = await request.json();

        // If store already configured, prevent unauthorized overwrite
        if (existingPassword) {
            const authHeader = request.headers.get("X-Admin-Password") || request.headers.get("Authorization") || "";
            const isBearerValid = authHeader.startsWith("Bearer ") && atob(authHeader.replace("Bearer ", "")).startsWith(existingPassword + ":");
            const isDirectValid = authHeader === existingPassword;
            if (!isBearerValid && !isDirectValid) {
                return json({ success: false, error: "Store is already initialized. Please login with your admin password to make changes." }, 403);
            }
        }

        const adminEmail = (body.admin_email || "admin@example.com").trim().toLowerCase();
        const adminPassword = (body.admin_password || "").trim();
        const resellerApiKey = (body.reseller_api_key || "").trim();
        const mainApiUrl = (body.main_api_url || "https://dnshub.pages.dev").trim();
        const siteName = (body.site_name || "UltraDNS Pro").trim();
        const tagline = (body.tagline || "High-Speed Private DNS for Banking & Global Access").trim();
        const supportWhatsapp = (body.support_whatsapp || "").trim();
        const supportTelegram = (body.support_telegram || "").trim();
        const currency = (body.currency || "SAR").trim();
        const currencySymbol = (body.currency_symbol || "﷼").trim();
        const notice = (body.notice || "⚡ Instant DNS activation after payment verification! 24/7 dedicated support.").trim();

        if (!adminEmail) {
            return json({ success: false, error: "Admin Email is required." }, 400);
        }

        if (!adminPassword) {
            return json({ success: false, error: "Admin Password is required." }, 400);
        }

        if (!resellerApiKey) {
            return json({ success: false, error: "Reseller API Key is required." }, 400);
        }

        // Test API key against Main Platform to verify validity & fetch reseller username
        let resellerInfo = null;
        try {
            const verifyRes = await fetch(`${mainApiUrl}/api/v1/me`, {
                headers: { "X-API-Key": resellerApiKey }
            });
            if (verifyRes.ok) {
                const data = await verifyRes.json();
                if (data.success) {
                    resellerInfo = data.data;
                }
            }
        } catch (e) {
            console.error("API key validation error:", e);
        }

        // Save settings into D1
        await setSetting(env, "admin_email", adminEmail);
        await setSetting(env, "admin_password", adminPassword);
        await setSetting(env, "reseller_api_key", resellerApiKey);
        await setSetting(env, "main_api_url", mainApiUrl);
        await setSetting(env, "site_name", siteName);
        await setSetting(env, "tagline", tagline);
        await setSetting(env, "support_whatsapp", supportWhatsapp);
        await setSetting(env, "support_telegram", supportTelegram);
        await setSetting(env, "currency", currency);
        await setSetting(env, "currency_symbol", currencySymbol);
        await setSetting(env, "notice", notice);

        // Default payment methods if provided
        if (body.payment_methods) {
            await setSetting(env, "payment_methods", body.payment_methods);
        } else {
            await setSetting(env, "payment_methods", [
                { id: "stcpay", name: "STC Pay", number: supportWhatsapp || "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
                { id: "urpay", name: "Urpay", number: supportWhatsapp || "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
                { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
            ]);
        }

        // Default plans if provided
        if (body.plans) {
            await setSetting(env, "plans", body.plans);
        } else {
            await setSetting(env, "plans", [
                { id: "1m", name: "1 Month Pass", duration_days: 30, price: 15, popular: false, features: ["30 Days Validity", "All Banking Apps Supported", "Zero Speed Drop", "Dedicated Support"] },
                { id: "3m", name: "3 Months Saver", duration_days: 90, price: 40, popular: true, badge: "MOST POPULAR", features: ["90 Days Validity", "Priority High-Speed Server", "All VoIP & Banking Apps", "24/7 Priority Support"] },
                { id: "1y", name: "1 Year VIP Access", duration_days: 365, price: 130, popular: false, badge: "BEST VALUE", features: ["365 Days Uninterrupted", "VIP Dedicated Routing", "All Apps & HD VoIP", "Lifetime Replacement Guarantee"] }
            ]);
        }

        const token = btoa(adminPassword + ":" + Date.now());

        return json({
            success: true,
            message: "🎉 Store initialized successfully!",
            token: token,
            reseller: resellerInfo || { username: "Reseller", credits: "N/A" }
        });
    } catch (e) {
        console.error("Setup error:", e);
        return json({ success: false, error: "Setup failed: " + e.message }, 500);
    }
}
