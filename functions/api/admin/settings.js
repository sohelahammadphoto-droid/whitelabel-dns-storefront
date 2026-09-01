// functions/api/admin/settings.js — Reseller Storefront Settings & Design Customizer API
import { initDb, verifyAuth, getAllSettings, setSetting, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: Get all store settings & design tokens
export async function onRequestGet(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    const s = await getAllSettings(env);

    // Provide default fallbacks for all customizable settings
    const data = {
        // --- 1. Branding ---
        site_name: s.site_name || env.SITE_NAME || "UltraDNS Pro",
        site_badge: s.site_badge || "PRO",
        site_logo: s.site_logo || "",
        site_favicon: s.site_favicon || "",
        owner_name: s.owner_name || env.OWNER_NAME || "Premium Services",
        tagline: s.tagline || env.TAGLINE || "High-Speed Private DNS for Banking & Global Access",
        currency: s.currency || env.CURRENCY || "SAR",
        currency_symbol: s.currency_symbol || env.CURRENCY_SYMBOL || "﷼",

        // --- 2. Theme & Colors ---
        theme_primary: s.theme_primary || "#6366f1",
        theme_primary_hover: s.theme_primary_hover || "#4f46e5",
        theme_accent: s.theme_accent || "#06b6d4",
        theme_accent_emerald: s.theme_accent_emerald || "#10b981",
        theme_bg_mode: s.theme_bg_mode || "cyber",
        theme_card_bg: s.theme_card_bg || "rgba(18, 26, 43, 0.75)",
        theme_border_glow: s.theme_border_glow || "rgba(99, 102, 241, 0.3)",

        // --- 3. Notice Bar ---
        notice_enabled: s.notice_enabled !== undefined ? Boolean(s.notice_enabled) : true,
        notice: s.notice || env.NOTICE || "⚡ Instant Private DNS Activation after payment verification! 24/7 dedicated support.",

        // --- 4. Hero Content & Buttons ---
        hero_pill_text: s.hero_pill_text || "Tier-1 Dedicated Private DNS Servers Online",
        hero_title_line1: s.hero_title_line1 || "Lightning Fast, Encrypted",
        hero_title_line2: s.hero_title_line2 || "Private DNS Access",
        hero_subtitle: s.hero_subtitle || "Uninterrupted zero-lag connection for mobile banking, encrypted streaming, and HD VoIP voice protocols.",
        btn_hero_buy_text: s.btn_hero_buy_text || "🚀 Get Private DNS Now",
        btn_hero_check_text: s.btn_hero_check_text || "🔍 Check Existing PIN",

        // --- 5. Features Section ---
        features_title: s.features_title || "Engineered for Perfection",
        features_subtitle: s.features_subtitle || "Why thousands of global users trust our encrypted DNS infrastructure",

        // --- 6. Pricing Section ---
        pricing_title: s.pricing_title || "Select Your Pass",
        pricing_subtitle: s.pricing_subtitle || "Flexible packages tailored for individuals and families",
        btn_plan_card_text: s.btn_plan_card_text || "⚡ Get Instant Access",

        // --- 7. Status Checker ---
        checker_title: s.checker_title || "Check DNS Status & Validity",
        checker_subtitle: s.checker_subtitle || "Enter your Mobile Number or Assigned DNS PIN to view your connection details and remaining days.",
        checker_input_placeholder: s.checker_input_placeholder || "e.g. 0501234567 or u123456",
        btn_checker_text: s.btn_checker_text || "Check Status",

        // --- 8. Floating Support & Links ---
        support_whatsapp: s.support_whatsapp || env.SUPPORT_WHATSAPP || "",
        support_whatsapp_msg: s.support_whatsapp_msg || "Hello, I need assistance with Private DNS",
        support_telegram: s.support_telegram || env.SUPPORT_TELEGRAM || "",
        floating_support_enabled: s.floating_support_enabled !== undefined ? Boolean(s.floating_support_enabled) : true,

        // --- 9. Reseller API & Main Platform ---
        main_api_url: s.main_api_url || env.MAIN_API_URL || "https://dnshub.pages.dev",
        reseller_api_key: s.reseller_api_key || env.RESELLER_API_KEY || "",

        // --- 10. Email & OTP Verification ---
        email_provider: s.email_provider || "none", // none, brevo, gmail_smtp
        brevo_api_key: s.brevo_api_key || "",
        brevo_sender_email: s.brevo_sender_email || "",
        brevo_sender_name: s.brevo_sender_name || (s.site_name || "UltraDNS Pro"),
        smtp_gmail_email: s.smtp_gmail_email || "",
        smtp_gmail_app_password: s.smtp_gmail_app_password || "",
        smtp_sender_name: s.smtp_sender_name || (s.site_name || "UltraDNS Pro"),

        // --- 11. Anti-Bot Security ---
        turnstile_site_key: s.turnstile_site_key || "",
        turnstile_secret_key: s.turnstile_secret_key || "",

        // --- 12. Payment Methods ---
        payment_methods: s.payment_methods || [
            { id: "stcpay", name: "STC Pay", number: "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
            { id: "urpay", name: "Urpay", number: "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
            { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
        ],

        // --- 13. Plans ---
        plans: s.plans || [
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

// POST: Update store settings & design tokens
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
