// functions/api/user/change-password.js — Customer Password Change API
import { initDb, verifyCustomerAuth, hashPassword, verifyPassword, json, handleOptions } from "../_db.js";

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

    const customer = await verifyCustomerAuth(request, env);
    if (!customer) {
        return json({ success: false, error: "Unauthorized. Please log in." }, 401);
    }

    try {
        const body = await request.json();
        const currentPassword = (body.current_password || "").trim();
        const newPassword = (body.new_password || "").trim();

        if (!currentPassword || !newPassword) {
            return json({ success: false, error: "Current password and new password are required." }, 400);
        }

        if (newPassword.length < 6) {
            return json({ success: false, error: "New password must be at least 6 characters long." }, 400);
        }

        if (!env.DB) {
            return json({ success: false, error: "Database not configured." }, 500);
        }

        // Fetch current password hash from DB
        const dbCustomer = await env.DB.prepare("SELECT password_hash FROM customers WHERE id = ?").bind(customer.id).first();
        if (!dbCustomer) {
            return json({ success: false, error: "Customer record not found." }, 404);
        }

        const isMatch = await verifyPassword(currentPassword, dbCustomer.password_hash);
        if (!isMatch) {
            return json({ success: false, error: "Incorrect current password." }, 400);
        }

        // Hash and update to new password
        const newHash = await hashPassword(newPassword);
        await env.DB.prepare("UPDATE customers SET password_hash = ? WHERE id = ?").bind(newHash, customer.id).run();

        return json({
            success: true,
            message: "Password changed successfully! For security, please log in with your new password.",
            password_changed: true
        });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
