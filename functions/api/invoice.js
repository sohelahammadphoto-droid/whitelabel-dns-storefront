// functions/api/invoice.js — Printable Digital Invoice & Receipt API
import { initDb, getAllSettings, json } from "./_db.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    const url = new URL(request.url);
    const orderId = (url.searchParams.get("id") || "").trim();

    if (!orderId || !env.DB) {
        return new Response("Order ID required", { status: 400 });
    }

    try {
        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first();
        if (!order) {
            return new Response("Invoice not found", { status: 404 });
        }

        const s = await getAllSettings(env);
        const siteName = s.site_name || "UltraDNS Pro";
        const ownerName = s.owner_name || "Premium Services";
        const currencySymbol = s.currency_symbol || "﷼";

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${order.order_id} — ${siteName}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { background: #f8fafc; color: #1e293b; padding: 40px 20px; }
        .invoice-card { max-width: 650px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 25px; }
        .brand { font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .badge-approved { background: #dcfce7; color: #15803d; }
        .badge-pending { background: #fef9c3; color: #a16207; }
        .badge-rejected { background: #fee2e2; color: #b91c1c; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th { text-align: left; padding: 12px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
        .table td { padding: 14px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row { display: flex; justify-content: flex-end; margin-bottom: 30px; font-size: 18px; font-weight: 800; color: #0f172a; }
        .dns-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 25px; font-size: 13px; }
        .print-btn { background: #4f46e5; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        @media print { .no-print { display: none; } body { padding: 0; background: #fff; } .invoice-card { box-shadow: none; border: none; padding: 0; } }
    </style>
</head>
<body>
    <div class="invoice-card">
        <div class="header">
            <div>
                <div class="brand">⚡ ${siteName}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Official Payment Receipt</div>
            </div>
            <div style="text-align: right;">
                <span class="badge badge-${order.status}">${order.status}</span>
                <div style="font-size: 13px; color: #64748b; margin-top: 6px;">#${order.order_id}</div>
            </div>
        </div>

        <div class="details-grid">
            <div>
                <b style="color: #64748b; font-size: 12px; text-transform: uppercase;">Customer Details:</b>
                <div style="margin-top: 4px; font-weight: 600;">${order.customer_name}</div>
                <div style="color: #64748b;">Phone: ${order.customer_phone}</div>
                ${order.customer_email ? `<div style="color: #64748b;">Email: ${order.customer_email}</div>` : ''}
            </div>
            <div style="text-align: right;">
                <b style="color: #64748b; font-size: 12px; text-transform: uppercase;">Payment Details:</b>
                <div style="margin-top: 4px;">Method: <b>${order.payment_method}</b></div>
                <div style="color: #64748b;">TrxID: <code style="font-family: monospace;">${order.trx_id}</code></div>
                <div style="color: #64748b; font-size: 12px;">Date: ${order.created_at}</div>
            </div>
        </div>

        ${order.dns_url ? `
        <div class="dns-banner">
            <div style="font-weight: 700; color: #166534; margin-bottom: 4px;">🌐 Active Private DNS Access:</div>
            <div style="font-family: monospace; font-size: 15px; font-weight: 800; color: #0f172a;">${order.dns_url}</div>
            <div style="font-size: 12px; color: #15803d; margin-top: 4px;">Assigned PIN: <b>${order.client_id}</b> | Expires: <b>${order.expire_date || 'Active'}</b></div>
        </div>
        ` : ''}

        <table class="table">
            <thead>
                <tr>
                    <th>Item / Description</th>
                    <th>Duration</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><b>${order.plan_name}</b><br><span style="font-size: 12px; color: #64748b;">Encrypted DNS Protocol Access</span></td>
                    <td>${order.duration_days} Days</td>
                    <td style="text-align: right; font-weight: 700;">${order.amount} ${order.currency || currencySymbol}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-row">
            Total Paid: ${order.amount} ${order.currency || currencySymbol}
        </div>

        <div style="text-align: center; margin-top: 40px;" class="no-print">
            <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>

        <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            &copy; ${new Date().getFullYear()} ${siteName} (${ownerName}). Thank you for your business!
        </div>
    </div>
</body>
</html>`;

        return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    } catch (e) {
        return new Response("Error generating invoice: " + e.message, { status: 500 });
    }
}
