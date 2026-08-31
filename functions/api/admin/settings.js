// functions/api/admin/settings.js — Reseller Storefront Settings API
import { initDb, json, handleOptions } from "../_db.js";

function verifyAuth(request, env) {
    const authHeader = request.headers.get("X-Admin-Password") || request.headers.get("Authorization") || "";
    const expected = (env.ADMIN_PASSWORD || "admin123").trim();
    if (authHeader.startsWith("Bearer ")) {
        try {
            const decoded = atob(authHeader.replace("Bearer ", ""));
            return decoded.startsWith(expected + ":");
        } catch {
            return false;
        }
    }
    return authHeader === expected;
}

export async function onRequestOptions() {
    return handleOptions();
}

// GET: Get all store settings
export async function onRequestGet(context) {
    const { request, env } = context;
    if (!verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    let settings = {};
    if (env.DB) {
        const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
        if (rows && rows.results) {
            for (const r of rows.results) {
                try {
                    settings[r.key] = JSON.parse(r.value);
                } catch {
                    settings[r.key] = r.value;
                }
            }
        }
    }

    return json({
        success: true,
        data: settings
    });
}

// POST: Update store settings
export async function onRequestPost(context) {
    const { request, env } = context;
    if (!verifyAuth(request, env)) {
        return json({ success: false, error: "Unauthorized" }, 401);
    }
    await initDb(env);

    try {
        const body = await request.json();

        if (!env.DB) {
            return json({ success: false, error: "D1 Database not configured" }, 500);
        }

        for (const [key, val] of Object.entries(body)) {
            const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
            await env.DB.prepare(`
                INSERT INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).bind(key, valStr).run();
        }

        return json({
            success: true,
            message: "Settings updated successfully!"
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
