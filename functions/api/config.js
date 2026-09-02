// functions/api/config.js — Public Dynamic Storefront Configuration & Theme Tokens API
import { initDb, getAllSettings, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    const s = await getAllSettings(env);

    // Dynamic config with fallback tokens
    const config = {
        // --- 1. Branding & Identity ---
        site_name: s.site_name || env.SITE_NAME || "UltraDNS Pro",
        site_badge: s.site_badge || "PRO",
        site_logo: s.site_logo || "", // Custom logo data URL or image link
        site_favicon: s.site_favicon || "", // Custom favicon data URL or image link
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

        // --- 2. Theme & Color Tokens ---
        theme_preset: s.theme_preset || "cyber", // cyber, amoled, navy, slate, sunset, violet, emerald
        theme_primary: s.theme_primary || "#6366f1", // Primary Brand
        theme_primary_hover: s.theme_primary_hover || "#4f46e5",
        theme_accent: s.theme_accent || "#06b6d4",   // Secondary Accent
        theme_accent_emerald: s.theme_accent_emerald || "#10b981",
        theme_bg_mode: s.theme_bg_mode || "cyber",   // cyber, amoled, navy, slate, sunset, violet, emerald
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

        // --- 4. Notice / Announcement Bar ---
        notice_enabled: s.notice_enabled !== undefined ? Boolean(s.notice_enabled) : true,
        notice: s.notice || env.NOTICE || "⚡ Instant Private DNS Activation after payment verification! 24/7 dedicated support.",

        // --- 5. Hero Section Content ---
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

        // --- 7. Features Section Customizer ---
        features_title: s.features_title || "Engineered for Perfection",
        features_subtitle: s.features_subtitle || "Why thousands of global users trust our encrypted DNS infrastructure",
        features: s.features || [
            { icon: "🛡️", title: "Zero-Lag Banking", desc: "Instant TLS acceleration for all digital wallets, mobile apps, and financial portals without VPN throttling." },
            { icon: "📞", title: "Crystal-Clear VoIP", desc: "Optimized low-latency routing for seamless voice and video calls anywhere in the world." },
            { icon: "🔒", title: "Cryptographic DoT", desc: "Military-grade DNS-over-TLS encryption ensures your browsing data stays 100% private and tamper-proof." },
            { icon: "⚡", title: "Instant Activation", desc: "Automated deployment gives you your unique private DNS hostname within minutes." }
        ],

        // --- 8. Pricing Section Customizer ---
        pricing_title: s.pricing_title || "Select Your Pass",
        pricing_subtitle: s.pricing_subtitle || "Flexible packages tailored for individuals and families",
        btn_plan_card_text: s.btn_plan_card_text || "⚡ Get Instant Access",

        // --- 9. Status Checker Customizer ---
        checker_title: s.checker_title || "Check DNS Status & Validity",
        checker_subtitle: s.checker_subtitle || "Enter your Mobile Number or Assigned DNS PIN to view your connection details and remaining days.",
        checker_input_placeholder: s.checker_input_placeholder || "e.g. 0501234567 or u123456",
        btn_checker_text: s.btn_checker_text || "Check Status",

        // --- 10. Customer Reviews & Testimonials Section ---
        testimonials_title: s.testimonials_title || "What Our Customers Say",
        testimonials_subtitle: s.testimonials_subtitle || "Real feedback from verified active subscribers",
        testimonials: s.testimonials || [
            { name: "Ahmed K.", role: "Saudi Arabia", rating: 5, text: "bKash and CityTouch work instantly without any lag. Super smooth and high speed!" },
            { name: "Rafiqul Islam", role: "Dubai, UAE", rating: 5, text: "Best private DNS for overseas. WhatsApp and voice calls are crystal clear." },
            { name: "Tanvir H.", role: "Qatar", rating: 5, text: "Instant activation. Highly recommended for banking and zero-disconnect connection." }
        ],

        // --- 11. FAQ Accordion Section ---
        faq_title: s.faq_title || "Frequently Asked Questions",
        faq_subtitle: s.faq_subtitle || "Everything you need to know about our Private DNS service",
        faqs: s.faqs || [
            { q: "Do I need to install any VPN app?", a: "No app required! You just paste the private DNS hostname in your phone's native Android or iOS settings." },
            { q: "How long does activation take?", a: "Activation takes less than 2 minutes after your payment transaction is verified by our system." },
            { q: "Will this slow down my internet speed?", a: "Not at all. Private DNS operates at the protocol level without heavy encryption tunnel overhead, giving you 100% native speed." },
            { q: "Can I use it on both Android and iPhone?", a: "Yes! We support native Android Private DNS (DoT) and iOS signed configuration profiles." }
        ],

        // --- 12. Custom HTML / Marketing Block ---
        custom_html: s.custom_html || "",

        // --- 13. Custom CSS & JS Injector ---
        custom_css: s.custom_css || "",
        custom_js: s.custom_js || "",

        // --- 14. Floating Support & Social Links ---
        support_whatsapp: s.support_whatsapp || env.SUPPORT_WHATSAPP || "",
        support_whatsapp_msg: s.support_whatsapp_msg || "Hello, I need assistance with Private DNS",
        support_telegram: s.support_telegram || env.SUPPORT_TELEGRAM || "",
        floating_support_enabled: s.floating_support_enabled !== undefined ? Boolean(s.floating_support_enabled) : true,

        // --- 15. Anti-Bot Security ---
        turnstile_site_key: s.turnstile_site_key || "",

        // --- 16. Payment Methods & Automated Gateway ---
        uddoktapay_enabled: s.uddoktapay_enabled !== undefined ? Boolean(s.uddoktapay_enabled) : false,
        manual_payment_enabled: s.manual_payment_enabled !== undefined ? Boolean(s.manual_payment_enabled) : true,
        payment_methods: s.payment_methods || [
            { id: "stcpay", name: "STC Pay", number: "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
            { id: "urpay", name: "Urpay", number: "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
            { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
        ],

        // --- 17. Pricing Plans ---
        plans: s.plans || [
            { id: "1m", name: "1 Month Pass", duration_days: 30, price: 15, popular: false, features: ["30 Days Validity", "All Banking Apps Supported", "Zero Speed Drop", "Dedicated Support"] },
            { id: "3m", name: "3 Months Saver", duration_days: 90, price: 40, popular: true, badge: "MOST POPULAR", features: ["90 Days Validity", "Priority High-Speed Server", "All VoIP & Banking Apps", "24/7 Priority Support"] },
            { id: "1y", name: "1 Year VIP Access", duration_days: 365, price: 130, popular: false, badge: "BEST VALUE", features: ["365 Days Uninterrupted", "VIP Dedicated Routing", "All Apps & HD VoIP", "Lifetime Replacement Guarantee"] }
        ]
    };

    return json({
        success: true,
        data: config
    });
}
