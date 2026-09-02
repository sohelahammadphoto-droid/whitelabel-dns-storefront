// functions/api/_db.js — Auto-initializing D1 Database & Auth Helpers

export async function initDb(env) {
    if (!env.DB) return false;
    
    try {
        await env.DB.batch([
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT UNIQUE NOT NULL,
                    customer_id INTEGER,
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
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    phone TEXT,
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
                CREATE TABLE IF NOT EXISTS otps (
                    email TEXT PRIMARY KEY,
                    otp_code TEXT NOT NULL,
                    temp_data TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS coupons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    discount_type TEXT NOT NULL DEFAULT 'percent', -- percent, fixed
                    discount_val REAL NOT NULL,
                    min_amount REAL DEFAULT 0,
                    max_uses INTEGER DEFAULT 0, -- 0 = unlimited
                    used_count INTEGER DEFAULT 0,
                    expires_at TEXT,
                    status TEXT NOT NULL DEFAULT 'active', -- active, inactive
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS staff (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'support', -- superadmin, subreseller, support
                    credit_balance REAL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone)
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
            `),
            env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)
            `)
        ]);

        // Automated Schema Upgrades & Migrations
        try {
            await env.DB.prepare("ALTER TABLE orders ADD COLUMN customer_id INTEGER").run();
        } catch (_) {}

        return true;
    } catch (e) {
        console.error("D1 Init error:", e);
        return false;
    }
}

// Password hashing with SHA-256 + Salt
export async function hashPassword(password) {
    const salt = "whitelabel_dns_salt_";
    const enc = new TextEncoder();
    const data = enc.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password, hash) {
    const computed = await hashPassword(password);
    return computed === hash;
}

// Customer token creation and verification
export function createCustomerToken(customer) {
    const payload = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone || "",
        pass_sig: customer.password_hash ? customer.password_hash.substring(0, 12) : "",
        iat: Date.now()
    };
    return btoa(JSON.stringify(payload));
}

export async function verifyCustomerAuth(request, env) {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return null;

    try {
        const decoded = JSON.parse(atob(authHeader.replace("Bearer ", "")));
        if (!decoded || !decoded.id || !decoded.email) return null;

        if (env.DB) {
            const customer = await env.DB.prepare("SELECT id, name, email, phone, password_hash, created_at FROM customers WHERE id = ? AND email = ?")
                .bind(decoded.id, decoded.email.toLowerCase()).first();
            if (!customer) return null;

            // Invalidate token if customer's password has changed since token issuance
            if (decoded.pass_sig && customer.password_hash) {
                if (decoded.pass_sig !== customer.password_hash.substring(0, 12)) {
                    return null; // Password changed! Force re-login
                }
            }
            return customer;
        }
        return decoded;
    } catch {
        return null;
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

export async function getAdminEmail(env) {
    const dbEmail = await getSetting(env, "admin_email", null);
    if (dbEmail) return String(dbEmail).trim().toLowerCase();
    return (env.ADMIN_EMAIL || "").trim().toLowerCase();
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
    
    if (!expected) return false;

    if (authHeader.startsWith("Bearer ")) {
        try {
            const decoded = atob(authHeader.replace("Bearer ", ""));
            // Supports both "password:token" and "email:password:token"
            return decoded.startsWith(expected + ":") || decoded.includes(":" + expected + ":") || decoded.includes(":" + expected);
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
