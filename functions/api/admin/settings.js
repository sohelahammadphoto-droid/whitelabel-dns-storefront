// functions/api/admin/settings.js — Reseller Storefront Settings API
import { initDb, verifyAuth, getAllSettings, setSetting, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: Get all store settings
export async function onRequestGet(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    const settings = await getAllSettings(env);

    // Provide default fallbacks if missing
    const data = {
        site_name: settings.site_name || env.SITE_NAME || "UltraDNS Pro",
        tagline: settings.tagline || env.TAGLINE || "High-Speed Private DNS for Banking & Global Access",
        owner_name: settings.owner_name || env.OWNER_NAME || "Premium Services",
        support_whatsapp: settings.support_whatsapp || env.SUPPORT_WHATSAPP || "",
        support_telegram: settings.support_telegram || env.SUPPORT_TELEGRAM || "",
        main_api_url: settings.main_api_url || env.MAIN_API_URL || "https://dnshub.pages.dev",
        reseller_api_key: settings.reseller_api_key || env.RESELLER_API_KEY || "",
        currency: settings.currency || env.CURRENCY || "SAR",
        currency_symbol: settings.currency_symbol || env.CURRENCY_SYMBOL || "﷼",
        notice: settings.notice || env.NOTICE || "⚡ Instant DNS activation after payment verification! 24/7 dedicated support.",
        
        // Email & OTP verification settings
        email_provider: settings.email_provider || "none", // none, brevo, gmail_smtp
        brevo_api_key: settings.brevo_api_key || "",
        brevo_sender_email: settings.brevo_sender_email || "",
        brevo_sender_name: settings.brevo_sender_name || (settings.site_name || "UltraDNS Pro"),
        smtp_gmail_email: settings.smtp_gmail_email || "",
        smtp_gmail_app_password: settings.smtp_gmail_app_password || "",
        smtp_sender_name: settings.smtp_sender_name || (settings.site_name || "UltraDNS Pro"),

        // Anti-Bot & Turnstile settings
        turnstile_site_key: settings.turnstile_site_key || "",
        turnstile_secret_key: settings.turnstile_secret_key || "",

        payment_methods: settings.payment_methods || [
            { id: "stcpay", name: "STC Pay", number: "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
            { id: "urpay", name: "Urpay", number: "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
            { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
        ],
        plans: settings.plans || [
            { id: "1m", name: "1 Month Pass", duration_days: 30, price: 15, popular: false, features: ["30 Days Validity", "All Banking Apps Supported", "Zero Speed Drop", "Dedicated Support"] },
            { id: "3m", name: "3 Months Saver", duration_days: 90, price: 40, popular: true, badge: "MOST POPULAR", features: ["90 Days Validity", "Priority High-Speed Server", "All VoIP & Banking Apps", "24/7 Priority Support"] },
            { id: "1y", name: "1 Year VIP Access", duration_days: 365, price: 130, popular: false, badge: "BEST VALUE", features: ["365 Days Uninterrupted", "VIP Dedicated Routing", "All Apps & HD VoIP", "Lifetime Replacement Guarantee"] }
        ]
    };

    return json({
        success: true,
        data: data
    });
}

// POST: Update store settings
export async function onRequestPost(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const body = await request.json();

        if (!env.DB) {
            return json({ success: false, error: "D1 Database not configured" }, 500);
        }

        // Save each field into D1
        for (const [key, val] of Object.entries(body)) {
            // If updating new admin password
            if (key === "new_password") {
                if (val && String(val).trim()) {
                    await setSetting(env, "admin_password", String(val).trim());
                }
                continue;
            }
            await setSetting(env, key, val);
        }

        return json({
            success: true,
            message: "Settings saved successfully to database!"
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
