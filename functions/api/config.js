// functions/api/config.js — Public Site Configuration API
import { initDb, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    // Default fallback config
    let config = {
        site_name: env.SITE_NAME || "UltraDNS Pro",
        tagline: env.TAGLINE || "High-Speed Private DNS for Banking & Global Access",
        owner_name: env.OWNER_NAME || "Premium Services",
        support_whatsapp: env.SUPPORT_WHATSAPP || "+966500000000",
        support_telegram: env.SUPPORT_TELEGRAM || "",
        currency: env.CURRENCY || "SAR",
        currency_symbol: env.CURRENCY_SYMBOL || "﷼",
        notice: env.NOTICE || "⚡ Instant DNS activation after payment verification! 24/7 dedicated support.",
        payment_methods: [
            { id: "stcpay", name: "STC Pay", number: "0501234567", account_name: "Personal", instructions: "Send to this STC Pay number & copy TrxID." },
            { id: "urpay", name: "Urpay", number: "0501234567", account_name: "Personal", instructions: "Send via Urpay & copy TrxID." },
            { id: "bkash", name: "bKash (Send Money)", number: "01700000000", account_name: "Personal", instructions: "Send Money to bKash & copy TrxID." }
        ],
        plans: [
            { id: "1m", name: "1 Month Pass", duration_days: 30, price: 15, popular: false, features: ["30 Days Validity", "All Banking Apps Supported", "Zero Speed Drop", "Dedicated Support"] },
            { id: "3m", name: "3 Months Saver", duration_days: 90, price: 40, popular: true, badge: "MOST POPULAR", features: ["90 Days Validity", "Priority High-Speed Server", "All VoIP & Banking Apps", "24/7 Priority Support"] },
            { id: "1y", name: "1 Year VIP Access", duration_days: 365, price: 130, popular: false, badge: "BEST VALUE", features: ["365 Days Uninterrupted", "VIP Dedicated Routing", "All Apps & HD VoIP", "Lifetime Replacement Guarantee"] }
        ]
    };

    // If D1 settings table has custom config, override
    if (env.DB) {
        try {
            const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
            if (rows && rows.results) {
                for (const row of rows.results) {
                    try {
                        config[row.key] = JSON.parse(row.value);
                    } catch {
                        config[row.key] = row.value;
                    }
                }
            }
        } catch (e) {
            console.error("Config fetch error:", e);
        }
    }

    return json({
        success: true,
        data: config
    });
}
