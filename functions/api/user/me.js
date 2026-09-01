// functions/api/user/me.js — Logged-in Customer Profile & Real-Time DNS Status API
import { initDb, verifyCustomerAuth, getMainApiUrl, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestGet(context);
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

        const mainApiUrl = await getMainApiUrl(env);

        // 🔄 Real-Time Live Sync with Main Platform for each assigned PIN
        const syncedOrders = await Promise.all(orders.map(async (o) => {
            const clone = { ...o };
            if (clone.client_id) {
                try {
                    const checkRes = await fetch(`${mainApiUrl}/api/check-status?username=${encodeURIComponent(clone.client_id)}`, {
                        headers: { "User-Agent": "StorefrontRealTimeSync/1.0" }
                    });
                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        if (checkData.success && checkData.user) {
                            const liveUser = checkData.user;
                            const liveStatus = String(liveUser.status || "").toLowerCase(); // 'active', 'rejected', 'banned', 'expired'
                            
                            if (liveStatus === "rejected" || liveStatus === "banned" || liveStatus === "disabled" || !liveUser.dns_url) {
                                clone.status = "banned";
                                clone.live_banned = true;
                                // Sync local DB in background
                                if (env.DB && o.status !== "banned") {
                                    env.DB.prepare("UPDATE orders SET status = 'banned' WHERE id = ?").bind(o.id).run().catch(() => {});
                                }
                            } else if (liveStatus === "expired") {
                                clone.status = "expired";
                                if (env.DB && o.status !== "expired") {
                                    env.DB.prepare("UPDATE orders SET status = 'expired' WHERE id = ?").bind(o.id).run().catch(() => {});
                                }
                            } else if (liveStatus === "active" && liveUser.dns_url) {
                                clone.status = "approved";
                                clone.dns_url = liveUser.dns_url;
                                clone.expire_date = liveUser.expires_at || clone.expire_date;
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Real-time sync failed for ${clone.client_id}:`, err);
                }
            }
            return clone;
        }));

        // Filter truly active DNS services (status === 'approved', and NOT banned/rejected/expired)
        const activeServices = syncedOrders.filter(o => 
            (o.status === "approved" || o.status === "active") && 
            o.dns_url && 
            !o.live_banned && 
            o.status !== "banned" && 
            o.status !== "rejected" && 
            o.status !== "expired"
        );

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
            orders: syncedOrders
        });
    } catch (e) {
        console.error("User me error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
