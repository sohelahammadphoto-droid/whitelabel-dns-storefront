// functions/api/coupon.js — Public Coupon Validation & Discount Calculator Endpoint
import { initDb, json, handleOptions } from "./_db.js";

export async function onRequestOptions() {
    return handleOptions();
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
        const amount = parseFloat(body.amount) || 0;

        if (!code) {
            return json({ success: false, error: "Coupon code is required" }, 400);
        }

        const coupon = await env.DB.prepare(
            "SELECT * FROM coupons WHERE code = ? AND status = 'active'"
        ).bind(code).first();

        if (!coupon) {
            return json({ success: false, error: "Invalid or expired coupon code" }, 404);
        }

        // Check expiration date
        if (coupon.expires_at) {
            const expTime = new Date(coupon.expires_at).getTime();
            if (Date.now() > expTime) {
                return json({ success: false, error: "This coupon code has expired" }, 400);
            }
        }

        // Check max uses limit
        if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
            return json({ success: false, error: "This coupon has reached its usage limit" }, 400);
        }

        // Check minimum order amount
        if (coupon.min_amount > 0 && amount < coupon.min_amount) {
            return json({
                success: false,
                error: `Minimum order amount for this coupon is ${coupon.min_amount}`
            }, 400);
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === "percent") {
            discount = (amount * coupon.discount_val) / 100;
        } else {
            discount = coupon.discount_val;
        }

        discount = Math.min(discount, amount);
        const finalAmount = Math.max(0, amount - discount);

        return json({
            success: true,
            data: {
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_val: coupon.discount_val,
                discount_amount: Number(discount.toFixed(2)),
                final_amount: Number(finalAmount.toFixed(2))
            }
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
