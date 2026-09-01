// functions/api/admin/coupons.js — Admin Coupon Management API
import { initDb, verifyAuth, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: List all coupons
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
        const rows = await env.DB.prepare(
            "SELECT * FROM coupons ORDER BY created_at DESC"
        ).all();

        return json({
            success: true,
            data: rows ? rows.results : []
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// POST: Create or Update coupon
export async function onRequestPost(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const body = await request.json();
        const code = (body.code || "").trim().toUpperCase();
        const discount_type = body.discount_type === "fixed" ? "fixed" : "percent";
        const discount_val = Number(body.discount_val || 0);
        const min_amount = Number(body.min_amount || 0);
        const max_uses = Number(body.max_uses || 0);
        const expires_at = body.expires_at || null;
        const status = body.status === "inactive" ? "inactive" : "active";

        if (!code || discount_val <= 0) {
            return json({ success: false, error: "Valid coupon code and discount value are required" }, 400);
        }

        if (body.id) {
            // Update existing
            await env.DB.prepare(`
                UPDATE coupons 
                SET code = ?, discount_type = ?, discount_val = ?, min_amount = ?, max_uses = ?, expires_at = ?, status = ?
                WHERE id = ?
            `).bind(code, discount_type, discount_val, min_amount, max_uses, expires_at, status, body.id).run();

            return json({ success: true, message: "Coupon updated successfully" });
        } else {
            // Create new
            await env.DB.prepare(`
                INSERT INTO coupons (code, discount_type, discount_val, min_amount, max_uses, expires_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(code, discount_type, discount_val, min_amount, max_uses, expires_at, status).run();

            return json({ success: true, message: "Coupon created successfully" });
        }
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// DELETE: Delete coupon
export async function onRequestDelete(context) {
    const { request, env } = context;
    if (!await verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    if (!env.DB) {
        return json({ success: false, error: "Database not configured" }, 500);
    }

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return json({ success: false, error: "Coupon ID is required" }, 400);
        }

        await env.DB.prepare("DELETE FROM coupons WHERE id = ?").bind(id).run();
        return json({ success: true, message: "Coupon deleted successfully" });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
