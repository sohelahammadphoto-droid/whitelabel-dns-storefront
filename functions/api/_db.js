// functions/api/_db.js — Auto-initializing D1 Database Helper

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
