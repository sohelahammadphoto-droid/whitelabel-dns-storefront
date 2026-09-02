// functions/api/payment/bdusp/checkout.js — BDUSP Pay Checkout Initializer
import { initDb, getSetting, verifyCustomerAuth, json, handleOptions } from "../../_db.js";
import { verifyAntiBot } from "../../_antibot.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") return handleOptions();
    return onRequestPost(context);
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();

        // 🛡️ Anti-Bot Check
        const antiBot = await verifyAntiBot(request, body, env);
        if (!antiBot.ok) {
            return json({ success: false, error: antiBot.error }, antiBot.status || 400);
        }

        // Check if BDUSP Pay is enabled and credentials configured
        const isEnabled = await getSetting(env, "bdusp_enabled", false);
        const apiKey = (await getSetting(env, "bdusp_api_key", "") || "").trim();
        const secretKey = (await getSetting(env, "bdusp_secret_key", "") || "").trim();
        const brandKey = (await getSetting(env, "bdusp_brand_key", "") || "").trim();

        if (!isEnabled || !apiKey || !secretKey || !brandKey) {
            return json({ success: false, error: "BDUSP Pay gateway is currently unavailable. Please choose another payment method or contact support." }, 400);
        }

        const customerName = (body.customer_name || "Valued Customer").trim();
        const customerPhone = (body.customer_phone || "").trim();
        const customerEmail = (body.customer_email || "customer@dnsstore.com").trim().toLowerCase();
        const planId = (body.plan_id || "1m").trim();
        const planName = (body.plan_name || "Private DNS Pass").trim();
        const durationDays = parseInt(body.duration_days || 30, 10);
        const amount = parseFloat(body.amount || 0);
        const currency = (body.currency || "BDT").trim();
        const couponCode = (body.coupon_code || "").trim();

        if (!customerName || !customerPhone) {
            return json({ success: false, error: "Name and phone number are required." }, 400);
        }

        if (amount <= 0) {
            return json({ success: false, error: "Invalid payment amount." }, 400);
        }

        let customerId = null;
        const loggedCustomer = await verifyCustomerAuth(request, env);
        if (loggedCustomer) {
            customerId = loggedCustomer.id;
        }

        // Generate unique Order ID
        const randId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const orderId = `ORD-${randId}`;

        const urlObj = new URL(request.url);
        const origin = `${urlObj.protocol}//${urlObj.host}`;

        const bduspPayload = {
            cus_name: customerName,
            cus_email: customerEmail,
            amount: String(amount),
            success_url: `${origin}/api/payment/bdusp/return?order_id=${encodeURIComponent(orderId)}`,
            cancel_url: `${origin}/#plans`,
            metadata: {
                order_id: orderId,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: customerEmail,
                customer_id: customerId ? String(customerId) : "",
                plan_id: planId,
                plan_name: planName,
                duration_days: durationDays,
                amount: amount,
                currency: currency,
                coupon_code: couponCode
            }
        };

        const res = await fetch("https://pay.bdusp.com/api/payment/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "API-KEY": apiKey,
                "SECRET-KEY": secretKey,
                "BRAND-KEY": brandKey
            },
            body: JSON.stringify(bduspPayload)
        });

        const data = await res.json();

        if (data.status && data.payment_url) {
            return json({
                success: true,
                order_id: orderId,
                payment_url: data.payment_url,
                message: "Payment session created. Redirecting to BDUSP Pay..."
            });
        } else {
            console.error("BDUSP API Error:", data);
            return json({
                success: false,
                error: data.message || "Failed to initialize BDUSP Pay session."
            }, 400);
        }
    } catch (e) {
        console.error("BDUSP Checkout error:", e);
        return json({ success: false, error: e.message }, 500);
    }
}
