// functions/api/_db.js — Auto-initializing D1 Database & Settings Helper

export async function initDb(env) {
    if (!env.DB) return false;
    
    try {
        await env.DB.batch([
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT UNIQUE NOT NULL,
                    customer_name TEXT NOT NULL,
                    customer_phone TEXT NOT NULL,
                    customer_email TEXT,
                    plan_id TEXT NOT NULL,
                    plan_name TEXT NOT NULL,
                    duration_days INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'SAR',
                    payment_method TEXT NOT NULL,
                    trx_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
                    client_id TEXT,
                    dns_url TEXT,
                    expire_date TEXT,
                    admin_note TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone)
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
            `)
        ]);
        return true;
    } catch (e) {
        console.error("D1 Init error:", e);
        return false;
    }
}

export async function getSetting(env, key, defaultValue = null) {
    if (!env.DB) return defaultValue;
    try {
        const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
        if (!row || row.value === undefined || row.value === null) return defaultValue;
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    } catch {
        return defaultValue;
    }
}

export async function setSetting(env, key, value) {
    if (!env.DB) return false;
    try {
        const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
        await env.DB.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).bind(key, valStr).run();
        return true;
    } catch (e) {
        console.error("setSetting error:", e);
        return false;
    }
}

export async function getAllSettings(env) {
    let settings = {};
    if (!env.DB) return settings;
    try {
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
    } catch (e) {
        console.error("getAllSettings error:", e);
    }
    return settings;
}

export async function getAdminPassword(env) {
    const dbPass = await getSetting(env, "admin_password", null);
    if (dbPass) return String(dbPass).trim();
    return (env.ADMIN_PASSWORD || "").trim();
}

export async function getResellerApiKey(env) {
    const dbKey = await getSetting(env, "reseller_api_key", null);
    if (dbKey) return String(dbKey).trim();
    return (env.RESELLER_API_KEY || "").trim();
}

export async function getMainApiUrl(env) {
    const dbUrl = await getSetting(env, "main_api_url", null);
    if (dbUrl) return String(dbUrl).trim();
    return (env.MAIN_API_URL || "https://dnshub.pages.dev").trim();
}

export async function verifyAuth(request, env) {
    const authHeader = request.headers.get("X-Admin-Password") || request.headers.get("Authorization") || "";
    const expected = await getAdminPassword(env);
    
    if (!expected) {
        return false;
    }

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

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password"
        }
    });
}

export function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password"
        }
    });
}
