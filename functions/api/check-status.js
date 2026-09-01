// functions/api/check-status.js — Public DNS & Order Status Checker API
import { initDb, getMainApiUrl, json, handleOptions } from "./_db.js";

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestGet(context);
}

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim();

    if (!query) {
        return json({ success: false, error: "Please enter your Phone Number, Order ID, or DNS PIN." }, 400);
    }

    try {
        let order = null;
        if (env.DB) {
            // Check local D1 orders first
            order = await env.DB.prepare(`
                SELECT order_id, customer_name, customer_phone, plan_name, duration_days,
                       status, client_id, dns_url, expire_date, created_at
                FROM orders
                WHERE order_id = ? OR customer_phone = ? OR client_id = ?
                ORDER BY created_at DESC LIMIT 1
            `).bind(query, query, query).first();
        }

        // Also query Main Platform API in real-time
        let liveDnsStatus = null;
        const mainApiUrl = await getMainApiUrl(env);
        const pinToCheck = order?.client_id || query;

        try {
            const res = await fetch(`${mainApiUrl}/api/check-status?username=${encodeURIComponent(pinToCheck)}`, {
                headers: { "User-Agent": "StorefrontRealTimeSync/1.0" }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    liveDnsStatus = data.user;
                }
            }
        } catch (_) {}

        if (!order && !liveDnsStatus) {
            return json({ success: false, error: "No active order or DNS key found with these details. Please check and try again." }, 404);
        }

        const isBanned = effectiveStatus === "rejected" || effectiveStatus === "banned" || effectiveStatus === "disabled";
        const banReason = liveDnsStatus?.ban_reason || liveDnsStatus?.reason || "";
        const detectedIps = liveDnsStatus?.detected_ips || liveDnsStatus?.violating_ips || liveDnsStatus?.ips || [];

        return json({
            success: true,
            data: {
                order_id: order?.order_id || "DIRECT-PIN",
                customer_name: order?.customer_name || "Valued User",
                customer_phone: order?.customer_phone || "",
                plan_name: order?.plan_name || `${liveDnsStatus?.duration_days || 30} Days Pass`,
                status: effectiveStatus,
                is_banned: isBanned,
                ban_reason: banReason,
                detected_ips: detectedIps,
                banned_at: liveDnsStatus?.banned_at || null,
                client_id: liveDnsStatus?.username || order?.client_id || pinToCheck,
                dns_url: liveDnsStatus?.dns_url || order?.dns_url || "",
                expire_date: liveDnsStatus?.expires_at || order?.expire_date || "Active",
                duration_days: liveDnsStatus?.duration_days || order?.duration_days || 30
            }
        });
    } catch (e) {
        console.error("Check status error:", e);
        return json({ success: false, error: "Status check failed: " + e.message }, 500);
    }
}
