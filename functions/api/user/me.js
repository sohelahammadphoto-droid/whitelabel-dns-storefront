// functions/api/user/me.js — Logged-in Customer Profile & DNS Services API
import { initDb, verifyCustomerAuth, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    const customer = await verifyCustomerAuth(request, env);
    if (!customer) {
        return json({ success: false, error: "Unauthorized. Please log in." }, 401);
    }

    try {
        let orders = [];
        if (env.DB) {
            // Find orders by customer_id OR matching customer_email / phone
            const res = await env.DB.prepare(`
                SELECT * FROM orders 
                WHERE customer_id = ? OR customer_email = ? OR (customer_phone != '' AND customer_phone = ?)
                ORDER BY created_at DESC LIMIT 50
            `).bind(customer.id, customer.email.toLowerCase(), customer.phone || "").all();
            orders = res.results || [];
        }

        // Separate active DNS services
        const activeServices = orders.filter(o => o.status === "approved" && o.dns_url);

        return json({
            success: true,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                created_at: customer.created_at
            },
            active_dns: activeServices,
            active_services: activeServices,
            orders: orders
        });
    } catch (e) {
        console.error("User me error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
