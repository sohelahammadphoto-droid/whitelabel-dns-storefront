// functions/api/admin/analytics.js — Business Analytics & Sales Intelligence API
import { initDb, verifyAuth, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        // 1. Order Status Counts & Total Revenue
        const statsRow = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_orders,
                SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_revenue
            FROM orders
        `).first();

        // 2. Total Registered Customers
        const custRow = await env.DB.prepare("SELECT COUNT(*) as total_customers FROM customers").first();

        // 3. Top Payment Methods
        const paymentMethods = await env.DB.prepare(`
            SELECT payment_method, COUNT(*) as count, SUM(amount) as revenue
            FROM orders
            WHERE status = 'approved'
            GROUP BY payment_method
            ORDER BY count DESC
        `).all();

        // 4. Most Popular Plans
        const topPlans = await env.DB.prepare(`
            SELECT plan_name, COUNT(*) as count, SUM(amount) as revenue
            FROM orders
            WHERE status = 'approved'
            GROUP BY plan_name
            ORDER BY count DESC
        `).all();

        // 5. Recent 7-Day Orders Timeline
        const recentTrend = await env.DB.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as revenue
            FROM orders
            WHERE created_at >= DATE('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `).all();

        const totalOrders = statsRow ? statsRow.total_orders || 0 : 0;
        const approvedOrders = statsRow ? statsRow.approved_orders || 0 : 0;
        const pendingOrders = statsRow ? statsRow.pending_orders || 0 : 0;
        const rejectedOrders = statsRow ? statsRow.rejected_orders || 0 : 0;
        const totalRevenue = statsRow ? statsRow.total_revenue || 0 : 0;
        const totalCustomers = custRow ? custRow.total_customers || 0 : 0;
        const conversionRate = totalOrders > 0 ? ((approvedOrders / totalOrders) * 100).toFixed(1) : "0.0";

        return json({
            success: true,
            data: {
                total_orders: totalOrders,
                approved_orders: approvedOrders,
                pending_orders: pendingOrders,
                rejected_orders: rejectedOrders,
                total_revenue: Number(totalRevenue.toFixed(2)),
                total_customers: totalCustomers,
                conversion_rate: conversionRate,
                payment_methods: paymentMethods ? paymentMethods.results : [],
                top_plans: topPlans ? topPlans.results : [],
                recent_trend: recentTrend ? recentTrend.results : []
            }
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
