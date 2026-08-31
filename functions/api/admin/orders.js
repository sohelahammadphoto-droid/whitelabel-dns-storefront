// functions/api/admin/orders.js — Reseller Order Management API
import { initDb, verifyAuth, getResellerApiKey, getMainApiUrl, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: List all orders
export async function onRequestGet(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") || "all").trim();

    try {
        let query = "SELECT * FROM orders";
        const params = [];
        if (status !== "all") {
            query += " WHERE status = ?";
            params.push(status);
        }
        query += " ORDER BY created_at DESC LIMIT 100";

        let orders = [];
        if (env.DB) {
            const res = await env.DB.prepare(query).bind(...params).all();
            orders = res.results || [];
        }

        return json({ success: true, data: orders });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// POST: Action on order (approve, reject)
export async function onRequestPost(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const body = await request.json();
        const { order_id, action } = body;

        if (!order_id || !action) {
            return json({ success: false, error: "Missing order_id or action" }, 400);
        }

        if (!env.DB) {
            return json({ success: false, error: "D1 Database not configured" }, 500);
        }

        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_id = ?").bind(order_id).first();
        if (!order) {
            return json({ success: false, error: "Order not found" }, 404);
        }

        if (action === "reject") {
            await env.DB.prepare("UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?")
                .bind(order_id).run();
            return json({ success: true, message: "Order marked as rejected." });
        }

        if (action === "approve") {
            // Check if already approved
            if (order.status === "approved" && order.client_id) {
                return json({ success: true, message: "Order is already approved", data: order });
            }

            // Call Main Platform API to issue DNS PIN using D1 database key
            const apiKey = await getResellerApiKey(env);
            const mainApiUrl = await getMainApiUrl(env);

            if (!apiKey) {
                return json({ success: false, error: "Reseller API Key is not configured. Please enter your API key in Admin -> Store Settings." }, 400);
            }

            // Generate clean random username/PIN
            const cleanPhone = (order.customer_phone || "").replace(/[^0-9]/g, "").slice(-6);
            const username = "u" + (cleanPhone || Math.floor(100000 + Math.random() * 900000));

            const apiRes = await fetch(`${mainApiUrl}/api/v1/client/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": apiKey
                },
                body: JSON.stringify({
                    username: username,
                    phone: order.customer_phone,
                    duration_days: order.duration_days,
                    note: `Order ${order.order_id} (${order.customer_name})`
                })
            });

            const apiData = await apiRes.json();

            if (!apiRes.ok || !apiData.success) {
                return json({
                    success: false,
                    error: "Failed to generate DNS from Main Platform: " + (apiData.error || "Unknown error"),
                    details: apiData
                }, 400);
            }

            const clientData = apiData.data || {};
            const clientId = clientData.client_id || clientData.username || username;
            const dnsUrl = clientData.dot_domain || `${clientId}.dns.sohel.pp.ua`;
            const expireDate = clientData.expires_at || clientData.expire_date || "";

            // Update order in D1
            await env.DB.prepare(`
                UPDATE orders 
                SET status = 'approved', client_id = ?, dns_url = ?, expire_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
            `).bind(clientId, dnsUrl, expireDate, order_id).run();

            return json({
                success: true,
                message: "Order approved & DNS generated successfully!",
                data: {
                    order_id,
                    client_id: clientId,
                    dns_url: dnsUrl,
                    expire_date: expireDate,
                    status: "approved"
                }
            });
        }

        return json({ success: false, error: "Invalid action" }, 400);
    } catch (e) {
        console.error("Order action error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
