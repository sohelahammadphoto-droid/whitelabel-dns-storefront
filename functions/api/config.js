// functions/api/config.js — Public Site Configuration API
import { initDb, getAllSettings, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    const dbSettings = await getAllSettings(env);

    // Default fallback config merged with D1 settings
    const config = {
        site_name: dbSettings.site_name || env.SITE_NAME || "UltraDNS Pro",
        tagline: dbSettings.tagline || env.TAGLINE || "High-Speed Private DNS for Banking & Global Access",
        owner_name: dbSettings.owner_name || env.OWNER_NAME || "Premium Services",
        support_whatsapp: dbSettings.support_whatsapp || env.SUPPORT_WHATSAPP || "",
        support_telegram: dbSettings.support_telegram || env.SUPPORT_TELEGRAM || "",
        currency: dbSettings.currency || env.CURRENCY || "SAR",
        currency_symbol: dbSettings.currency_symbol || env.CURRENCY_SYMBOL || "﷼",
        notice: dbSettings.notice || env.NOTICE || "⚡ Instant DNS activation after payment verification! 24/7 dedicated support.",
        payment_methods: dbSettings.payment_methods || [
            { id: "stcpay", name: "STC Pay", number: "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
            { id: "urpay", name: "Urpay", number: "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
            { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
        ],
        plans: dbSettings.plans || [
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
