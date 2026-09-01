// functions/api/coupon.js — Public Coupon Code Validation API
import { initDb, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "").trim().toUpperCase();
    const amount = Number(url.searchParams.get("amount") || 0);

    return validateCoupon(env, code, amount);
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const body = await request.json();
        const code = (body.code || "").trim().toUpperCase();
        const amount = Number(body.amount || 0);
        return validateCoupon(env, code, amount);
    } catch (e) {
        return json({ success: false, error: "Invalid request payload: " + e.message }, 400);
    }
}

async function validateCoupon(env, code, amount) {
    if (!code) {
        return json({ success: false, error: "Coupon code is required" }, 400);
    }

    const coupon = await env.DB.prepare(
        "SELECT * FROM coupons WHERE UPPER(code) = ? AND status = 'active'"
    ).bind(code).first();

    if (!coupon) {
        return json({ success: false, error: "Invalid or expired coupon code" }, 404);
    }

    // Check expiration
    if (coupon.expires_at) {
        const expDate = new Date(coupon.expires_at).getTime();
        if (Date.now() > expDate) {
            return json({ success: false, error: "This coupon code has expired" }, 400);
        }
    }

    // Check max uses
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
        return json({ success: false, error: "Coupon usage limit reached" }, 400);
    }

    // Check minimum amount
    if (coupon.min_amount > 0 && amount < coupon.min_amount) {
        return json({ success: false, error: `Minimum order amount of ${coupon.min_amount} required for this coupon` }, 400);
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === "percent") {
        discount = (amount * coupon.discount_val) / 100;
    } else {
        discount = coupon.discount_val;
    }

    if (discount > amount) {
        discount = amount;
    }

    return json({
        success: true,
        coupon: {
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_val: coupon.discount_val
        },
        discount_amount: Number(discount.toFixed(2)),
        final_amount: Number((amount - discount).toFixed(2))
    });
}
