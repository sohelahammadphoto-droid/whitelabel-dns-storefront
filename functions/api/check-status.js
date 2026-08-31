// functions/api/check-status.js — Public DNS & Order Status Checker API
import { initDb, json, handleOptions } from "./_db.js";

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

        // Also query Main Platform API if client_id exists
        let liveDnsStatus = null;
        const mainApiUrl = env.MAIN_API_URL || "https://dnshub.pages.dev";
        const pinToCheck = order?.client_id || query;

        try {
            const res = await fetch(`${mainApiUrl}/api/check-status?client_id=${encodeURIComponent(pinToCheck)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    liveDnsStatus = data.data;
                }
            }
        } catch (_) {}

        if (!order && !liveDnsStatus) {
            return json({ success: false, error: "No active order or DNS key found with this details. Please check and try again." }, 404);
        }

        return json({
            success: true,
            data: {
                order_id: order?.order_id || "DIRECT-PIN",
                customer_name: order?.customer_name || "Valued User",
                customer_phone: order?.customer_phone || "",
                plan_name: order?.plan_name || (liveDnsStatus ? "Active Plan" : "Unknown"),
                status: order?.status || (liveDnsStatus?.status || "active"),
                client_id: liveDnsStatus?.client_id || order?.client_id || "",
                dns_url: liveDnsStatus?.dot_domain || order?.dns_url || "",
                expire_date: liveDnsStatus?.expires_at || order?.expire_date || "Active",
                days_left: liveDnsStatus?.days_left ?? null
            }
        });
    } catch (e) {
        console.error("Check status error:", e);
        return json({ success: false, error: "Status check failed: " + e.message }, 500);
    }
}
