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
        currencies: s.currencies || [
            { code: "SAR", symbol: "﷼", rate: 1.0, name: "Saudi Riyal" },
            { code: "BDT", symbol: "৳", rate: 32.0, name: "Bangladeshi Taka" },
            { code: "USD", symbol: "$", rate: 0.27, name: "US Dollar" },
            { code: "AED", symbol: "د.إ", rate: 0.98, name: "UAE Dirham" }
        ],

        // --- 2. Theme & Colors ---
        theme_preset: s.theme_preset || "cyber",
        theme_primary: s.theme_primary || "#6366f1",
        theme_primary_hover: s.theme_primary_hover || "#4f46e5",
        theme_accent: s.theme_accent || "#06b6d4",
        theme_accent_emerald: s.theme_accent_emerald || "#10b981",
        theme_bg_mode: s.theme_bg_mode || "cyber",
        theme_card_bg: s.theme_card_bg || "rgba(18, 26, 43, 0.75)",
        theme_border_glow: s.theme_border_glow || "rgba(99, 102, 241, 0.3)",

        // --- 3. Section Visibility Controls (Page Builder Lite) ---
        show_notice: s.show_notice !== undefined ? Boolean(s.show_notice) : (s.notice_enabled !== undefined ? Boolean(s.notice_enabled) : true),
        show_hero: s.show_hero !== undefined ? Boolean(s.show_hero) : true,
        show_stats: s.show_stats !== undefined ? Boolean(s.show_stats) : true,
        show_features: s.show_features !== undefined ? Boolean(s.show_features) : true,
        show_pricing: s.show_pricing !== undefined ? Boolean(s.show_pricing) : true,
        show_checker: s.show_checker !== undefined ? Boolean(s.show_checker) : true,
        show_testimonials: s.show_testimonials !== undefined ? Boolean(s.show_testimonials) : true,
        show_faq: s.show_faq !== undefined ? Boolean(s.show_faq) : true,
        show_guide: s.show_guide !== undefined ? Boolean(s.show_guide) : true,
        show_custom_html: s.show_custom_html !== undefined ? Boolean(s.show_custom_html) : false,

        // --- 4. Notice Bar ---
        notice_enabled: s.notice_enabled !== undefined ? Boolean(s.notice_enabled) : true,
        notice: s.notice || env.NOTICE || "⚡ Instant Private DNS Activation after payment verification! 24/7 dedicated support.",

        // --- 5. Hero Content & Buttons ---
        hero_pill_text: s.hero_pill_text || "Tier-1 Dedicated Private DNS Servers Online",
        hero_title_line1: s.hero_title_line1 || "Lightning Fast, Encrypted",
        hero_title_line2: s.hero_title_line2 || "Private DNS Access",
        hero_subtitle: s.hero_subtitle || "Uninterrupted zero-lag connection for mobile banking, encrypted streaming, and HD VoIP voice protocols.",
        btn_hero_buy_text: s.btn_hero_buy_text || "🚀 Get Private DNS Now",
        btn_hero_check_text: s.btn_hero_check_text || "🔍 Check Existing PIN",

        // --- 6. Live Stats Counter Section ---
        stats: s.stats || [
            { value: "99.9%", label: "Server Uptime", icon: "⚡" },
            { value: "5,000+", label: "Active Connections", icon: "👥" },
            { value: "< 1ms", label: "Query Latency", icon: "🚀" },
            { value: "50+", label: "Banking Apps Unlocked", icon: "🛡️" }
        ],

        // --- 7. Features Section ---
        features_title: s.features_title || "Engineered for Perfection",
        features_subtitle: s.features_subtitle || "Why thousands of global users trust our encrypted DNS infrastructure",
        features: s.features || [
            { icon: "🛡️", title: "Zero-Lag Banking", desc: "Instant TLS acceleration for all digital wallets, mobile apps, and financial portals without VPN throttling." },
            { icon: "📞", title: "Crystal-Clear VoIP", desc: "Optimized low-latency routing for seamless voice and video calls anywhere in the world." },
            { icon: "🔒", title: "Cryptographic DoT", desc: "Military-grade DNS-over-TLS encryption ensures your browsing data stays 100% private and tamper-proof." },
            { icon: "⚡", title: "Instant Activation", desc: "Automated deployment gives you your unique private DNS hostname within minutes." }
        ],

        // --- 8. Pricing Section ---
        pricing_title: s.pricing_title || "Select Your Pass",
        pricing_subtitle: s.pricing_subtitle || "Flexible packages tailored for individuals and families",
        btn_plan_card_text: s.btn_plan_card_text || "⚡ Get Instant Access",

        // --- 9. Status Checker ---
        checker_title: s.checker_title || "Check DNS Status & Validity",
        checker_subtitle: s.checker_subtitle || "Enter your Mobile Number or Assigned DNS PIN to view your connection details and remaining days.",
        checker_input_placeholder: s.checker_input_placeholder || "e.g. 0501234567 or u123456",
        btn_checker_text: s.btn_checker_text || "Check Status",

        // --- 10. Customer Reviews & Testimonials Section ---
        testimonials_title: s.testimonials_title || "What Our Customers Say",
        testimonials_subtitle: s.testimonials_subtitle || "Real feedback from verified active subscribers",
        testimonials: s.testimonials || [
            { name: "Ahmed K.", role: "Riyadh, KSA", rating: 5, text: "Ultra-fast response for STC Pay and Al Rajhi Bank. Never fails!" },
            { name: "Siddiqur R.", role: "Jeddah, KSA", rating: 5, text: "Excellent VoIP clarity for international calls. Best DNS service." },
            { name: "Faisal M.", role: "Dammam, KSA", rating: 5, text: "Instant activation right after submitting TrxID. 100% recommended." }
        ],

        // --- 11. Interactive FAQ Section ---
        faq_title: s.faq_title || "Frequently Asked Questions",
        faq_subtitle: s.faq_subtitle || "Everything you need to know about our Private DNS service",
        faqs: s.faqs || [
            { q: "Do I need to install any 3rd-party VPN app?", a: "No! Our Private DNS connects directly into Android's native Private DNS settings or iOS DNS profile. Zero battery drain and zero app overhead." },
            { q: "How long does activation take after payment?", a: "Instant to within 5 minutes. As soon as you enter your Transaction ID (TrxID), your private DNS hostname is assigned and activated." },
            { q: "Which banking and VoIP apps are supported?", a: "All standard mobile banking apps (bKash, Nagad, Upay, Citytouch, Al Rajhi, STC Pay, Urpay) and VoIP protocols (WhatsApp, Imo, BOTIM, Zangi)." }
        ],

        // --- 12. Custom HTML / Marketing Section ---
        custom_html: s.custom_html || "",

        // --- 13. Custom CSS & JS Injector ---
        custom_css: s.custom_css || "",
        custom_js: s.custom_js || "",

        // --- 14. Floating Support Widget ---
        floating_support_enabled: s.floating_support_enabled !== undefined ? Boolean(s.floating_support_enabled) : true,
        support_whatsapp: s.support_whatsapp || env.SUPPORT_WHATSAPP || "",
        support_telegram: s.support_telegram || env.SUPPORT_TELEGRAM || "",
        support_whatsapp_msg: s.support_whatsapp_msg || "Hello, I need assistance with Private DNS",

        // --- 15. Telegram Instant Alerts ---
        telegram_bot_token: s.telegram_bot_token || env.TELEGRAM_BOT_TOKEN || "",
        telegram_chat_id: s.telegram_chat_id || env.TELEGRAM_CHAT_ID || "",

        // --- 16. Core Reseller API & Security ---
        reseller_api_key: s.reseller_api_key || env.RESELLER_API_KEY || "",
        main_api_url: s.main_api_url || env.MAIN_API_URL || "https://dnshub.pages.dev",
        turnstile_site_key: s.turnstile_site_key || env.TURNSTILE_SITE_KEY || "",
        turnstile_secret_key: s.turnstile_secret_key || env.TURNSTILE_SECRET_KEY || "",

        // --- 17. Email & OTP Verification ---
        email_provider: s.email_provider || env.EMAIL_PROVIDER || "none",
        brevo_api_key: s.brevo_api_key || env.BREVO_API_KEY || "",
        brevo_sender_email: s.brevo_sender_email || env.BREVO_SENDER_EMAIL || "",
        brevo_sender_name: s.brevo_sender_name || env.BREVO_SENDER_NAME || "UltraDNS Security"
    };

    return json({ success: true, data });
}

// POST: Save all store settings & customizer changes
export async function onRequestPost(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const body = await request.json();

        // 1. Branding & Identity
        if (body.site_name !== undefined) await setSetting(env, "site_name", body.site_name);
        if (body.site_badge !== undefined) await setSetting(env, "site_badge", body.site_badge);
        if (body.site_logo !== undefined) await setSetting(env, "site_logo", body.site_logo);
        if (body.site_favicon !== undefined) await setSetting(env, "site_favicon", body.site_favicon);
        if (body.owner_name !== undefined) await setSetting(env, "owner_name", body.owner_name);
        if (body.tagline !== undefined) await setSetting(env, "tagline", body.tagline);
        if (body.currency !== undefined) await setSetting(env, "currency", body.currency);
        if (body.currency_symbol !== undefined) await setSetting(env, "currency_symbol", body.currency_symbol);
        if (body.currencies !== undefined) await setSetting(env, "currencies", body.currencies);

        // 2. Themes & Colors
        if (body.theme_preset !== undefined) await setSetting(env, "theme_preset", body.theme_preset);
        if (body.theme_primary !== undefined) await setSetting(env, "theme_primary", body.theme_primary);
        if (body.theme_primary_hover !== undefined) await setSetting(env, "theme_primary_hover", body.theme_primary_hover);
        if (body.theme_accent !== undefined) await setSetting(env, "theme_accent", body.theme_accent);
        if (body.theme_bg_mode !== undefined) await setSetting(env, "theme_bg_mode", body.theme_bg_mode);

        // 3. Section Visibility Toggles (Page Builder)
        if (body.show_notice !== undefined) await setSetting(env, "show_notice", Boolean(body.show_notice));
        if (body.show_hero !== undefined) await setSetting(env, "show_hero", Boolean(body.show_hero));
        if (body.show_stats !== undefined) await setSetting(env, "show_stats", Boolean(body.show_stats));
        if (body.show_features !== undefined) await setSetting(env, "show_features", Boolean(body.show_features));
        if (body.show_pricing !== undefined) await setSetting(env, "show_pricing", Boolean(body.show_pricing));
        if (body.show_checker !== undefined) await setSetting(env, "show_checker", Boolean(body.show_checker));
        if (body.show_testimonials !== undefined) await setSetting(env, "show_testimonials", Boolean(body.show_testimonials));
        if (body.show_faq !== undefined) await setSetting(env, "show_faq", Boolean(body.show_faq));
        if (body.show_guide !== undefined) await setSetting(env, "show_guide", Boolean(body.show_guide));
        if (body.show_custom_html !== undefined) await setSetting(env, "show_custom_html", Boolean(body.show_custom_html));

        // 4. Hero Content & Notice
        if (body.notice !== undefined) await setSetting(env, "notice", body.notice);
        if (body.hero_pill_text !== undefined) await setSetting(env, "hero_pill_text", body.hero_pill_text);
        if (body.hero_title_line1 !== undefined) await setSetting(env, "hero_title_line1", body.hero_title_line1);
        if (body.hero_title_line2 !== undefined) await setSetting(env, "hero_title_line2", body.hero_title_line2);
        if (body.hero_subtitle !== undefined) await setSetting(env, "hero_subtitle", body.hero_subtitle);
        if (body.btn_hero_buy_text !== undefined) await setSetting(env, "btn_hero_buy_text", body.btn_hero_buy_text);
        if (body.btn_hero_check_text !== undefined) await setSetting(env, "btn_hero_check_text", body.btn_hero_check_text);

        // 5. Dynamic Lists & Custom Blocks
        if (body.stats !== undefined) await setSetting(env, "stats", body.stats);
        if (body.faqs !== undefined) await setSetting(env, "faqs", body.faqs);
        if (body.testimonials !== undefined) await setSetting(env, "testimonials", body.testimonials);
        if (body.custom_html !== undefined) await setSetting(env, "custom_html", body.custom_html);
        if (body.custom_css !== undefined) await setSetting(env, "custom_css", body.custom_css);
        if (body.custom_js !== undefined) await setSetting(env, "custom_js", body.custom_js);

        // 6. Socials & Support
        if (body.support_whatsapp !== undefined) await setSetting(env, "support_whatsapp", body.support_whatsapp);
        if (body.support_telegram !== undefined) await setSetting(env, "support_telegram", body.support_telegram);
        if (body.support_whatsapp_msg !== undefined) await setSetting(env, "support_whatsapp_msg", body.support_whatsapp_msg);
        if (body.floating_support_enabled !== undefined) await setSetting(env, "floating_support_enabled", Boolean(body.floating_support_enabled));

        // 7. Telegram Alerts
        if (body.telegram_bot_token !== undefined) await setSetting(env, "telegram_bot_token", body.telegram_bot_token);
        if (body.telegram_chat_id !== undefined) await setSetting(env, "telegram_chat_id", body.telegram_chat_id);

        // 8. Core API & Security
        if (body.reseller_api_key !== undefined) await setSetting(env, "reseller_api_key", body.reseller_api_key);
        if (body.main_api_url !== undefined) await setSetting(env, "main_api_url", body.main_api_url);
        if (body.turnstile_site_key !== undefined) await setSetting(env, "turnstile_site_key", body.turnstile_site_key);
        if (body.turnstile_secret_key !== undefined) await setSetting(env, "turnstile_secret_key", body.turnstile_secret_key);

        // 9. Admin Password Change
        if (body.new_password && body.new_password.trim()) {
            await setSetting(env, "admin_password", body.new_password.trim());
        }

        // 10. Email & OTP Verification
        if (body.email_provider !== undefined) await setSetting(env, "email_provider", body.email_provider);
        if (body.brevo_api_key !== undefined) await setSetting(env, "brevo_api_key", body.brevo_api_key);
        if (body.brevo_sender_email !== undefined) await setSetting(env, "brevo_sender_email", body.brevo_sender_email);
        if (body.brevo_sender_name !== undefined) await setSetting(env, "brevo_sender_name", body.brevo_sender_name);

        return json({ success: true, message: "Settings saved successfully!" });
    } catch (e) {
        console.error("Settings save error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
