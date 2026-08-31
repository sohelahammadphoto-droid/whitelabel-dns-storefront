// functions/api/order.js — Public & Authenticated Customer Order Submission API
import { initDb, verifyCustomerAuth, json, handleOptions } from "./_db.js";

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
        const customerEmail = (body.customer_email || "").trim().toLowerCase();
        const planId = (body.plan_id || "").trim();
        const paymentMethod = (body.payment_method || "").trim();
        const trxId = (body.trx_id || "").trim();

        if (!customerName || !customerPhone || !planId || !paymentMethod || !trxId) {
            return json({ success: false, error: "Please fill in all required fields (Name, Phone, Plan, Payment Method, Transaction ID)" }, 400);
        }

        // Check if customer is logged in
        let customerId = null;
        let finalEmail = customerEmail;
        const loggedInUser = await verifyCustomerAuth(request, env);
        if (loggedInUser) {
            customerId = loggedInUser.id;
            finalEmail = loggedInUser.email;
        }

        // Map plan details from body or fallback
        const durationDays = parseInt(body.duration_days, 10) || 30;
        const planName = (body.plan_name || `${durationDays} Days Pass`).trim();
        const amount = parseFloat(body.amount) || 15;
        const currency = (body.currency || env.CURRENCY || "SAR").trim();

        const orderId = "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        if (env.DB) {
            await env.DB.prepare(`
                INSERT INTO orders (
                    order_id, customer_id, customer_name, customer_phone, customer_email,
                    plan_id, plan_name, duration_days, amount, currency,
                    payment_method, trx_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `).bind(
                orderId, customerId, customerName, customerPhone, finalEmail,
                planId, planName, durationDays, amount, currency,
                paymentMethod, trxId
            ).run();
        }

        return json({
            success: true,
            message: "Order submitted successfully! Your DNS code will be activated once payment is verified.",
            data: {
                order_id: orderId,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: finalEmail,
                plan_name: planName,
                amount: amount,
                currency: currency,
                status: "pending"
            }
        });
    } catch (e) {
        console.error("Order error:", e);
        return json({ success: false, error: "Failed to process order: " + e.message }, 500);
    }
}
