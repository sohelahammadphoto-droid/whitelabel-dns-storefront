// functions/api/admin/staff.js — Multi-Role Staff & Sub-Reseller Management API
import { initDb, verifyAuth, hashPassword, json, handleOptions } from "../_db.js";

export async function onRequestOptions() {
    return handleOptions();
}

// GET: List all staff members
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
            "SELECT id, username, name, role, credit_balance, status, created_at FROM staff ORDER BY created_at DESC"
        ).all();

        return json({
            success: true,
            data: rows ? rows.results : []
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// POST: Create staff member
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
        const username = (body.username || "").trim().toLowerCase();
        const password = (body.password || "").trim();
        const name = (body.name || "").trim();
        const role = (body.role || "support").trim(); // support, subreseller

        if (!username || !password || !name) {
            return json({ success: false, error: "Username, password and name are required" }, 400);
        }

        const passHash = await hashPassword(password);

        await env.DB.prepare(`
            INSERT INTO staff (username, password_hash, name, role, status)
            VALUES (?, ?, ?, ?, 'active')
        `).bind(username, passHash, name, role).run();

        return json({
            success: true,
            message: `Staff account (${username}) created successfully!`
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// DELETE: Delete staff member
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
            return json({ success: false, error: "Staff ID is required" }, 400);
        }

        await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
        return json({ success: true, message: "Staff account deleted successfully" });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
