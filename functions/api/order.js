// functions/api/order.js — Public Customer Order Submission API
import { initDb, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const customerName = (body.customer_name || "").trim();
        const customerPhone = (body.customer_phone || "").trim();
        const planId = (body.plan_id || "").trim();
        const paymentMethod = (body.payment_method || "").trim();
        const trxId = (body.trx_id || "").trim();

        if (!customerName || !customerPhone || !planId || !paymentMethod || !trxId) {
            return json({ success: false, error: "Please fill in all required fields (Name, Phone, Plan, Payment Method, Transaction ID)" }, 400);
        }

        // Map plan details
        const plans = [
            { id: "1m", name: "1 Month Pass", duration_days: 30, price: 15 },
            { id: "3m", name: "3 Months Saver", duration_days: 90, price: 40 },
            { id: "1y", name: "1 Year VIP Access", duration_days: 365, price: 130 }
        ];
        const selectedPlan = plans.find(p => p.id === planId) || plans[0];

        const orderId = "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const currency = env.CURRENCY || "SAR";

        if (env.DB) {
            await env.DB.prepare(`
                INSERT INTO orders (
                    order_id, customer_name, customer_phone, plan_id, plan_name,
                    duration_days, amount, currency, payment_method, trx_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `).bind(
                orderId, customerName, customerPhone, selectedPlan.id, selectedPlan.name,
                selectedPlan.duration_days, selectedPlan.price, currency, paymentMethod, trxId
            ).run();
        }

        return json({
            success: true,
            message: "Order submitted successfully! Your DNS code will be activated once payment is verified.",
            data: {
                order_id: orderId,
                customer_name: customerName,
                customer_phone: customerPhone,
                plan_name: selectedPlan.name,
                amount: selectedPlan.price,
                currency: currency,
                status: "pending"
            }
        });
    } catch (e) {
        console.error("Order error:", e);
        return json({ success: false, error: "Failed to process order: " + e.message }, 500);
    }
}
