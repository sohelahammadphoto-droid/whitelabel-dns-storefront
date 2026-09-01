// functions/api/_email.js — Multi-Provider Email & OTP Dispatch Helper
import { getSetting } from "./_db.js";

export async function sendOtpEmail(env, toEmail, toName, otpCode) {
    const provider = await getSetting(env, "email_provider", "none");
    const siteName = await getSetting(env, "site_name", "UltraDNS");

    if (provider === "none" || !provider) {
        return { success: false, skipped: true, error: "Email verification is disabled" };
    }

    const subject = `Your Verification Code: ${otpCode} — ${siteName}`;
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; }
            .card { max-width: 480px; margin: 0 auto; background: #121a2b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; }
            .header { text-align: center; margin-bottom: 25px; }
            .logo { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
            .badge { background: #6366f1; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px; }
            .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px; }
            .text { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
            .otp-box { background: rgba(99, 102, 241, 0.12); border: 2px dashed #6366f1; border-radius: 8px; padding: 18px; text-align: center; margin: 25px 0; }
            .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #38bdf8; }
            .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="logo">${siteName}</span>
                <span class="badge">SECURE</span>
            </div>
            <div class="title">Hello ${toName || 'User'},</div>
            <div class="text">
                Thank you for joining <b>${siteName}</b>. Please use the 6-digit verification code below to verify your Gmail address and activate your customer account:
            </div>
            <div class="otp-box">
                <div class="otp-code">${otpCode}</div>
            </div>
            <div class="text" style="font-size: 13px;">
                ⚡ This code is valid for <b>10 minutes</b>. Never share this code with anyone.
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.<br>
                Automated Security Verification.
            </div>
        </div>
    </body>
    </html>
    `;

    return dispatchEmail(env, toEmail, toName, subject, htmlContent);
}

export async function sendOrderApprovedEmail(env, toEmail, toName, orderDetails) {
    const siteName = await getSetting(env, "site_name", "UltraDNS");
    const subject = `🎉 Your Private DNS is Active! (PIN: ${orderDetails.clientId}) — ${siteName}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; }
            .card { max-width: 520px; margin: 0 auto; background: #121a2b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; }
            .header { text-align: center; margin-bottom: 25px; }
            .logo { font-size: 22px; font-weight: 800; color: #38bdf8; }
            .dns-box { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 18px; margin: 20px 0; }
            .code-line { font-family: monospace; font-size: 18px; font-weight: bold; color: #38bdf8; word-break: break-all; }
            .btn { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 15px; }
            .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="logo">${siteName}</span>
            </div>
            <h2 style="color: #34d399; margin-top:0;">🎉 Your DNS Subscription is Active!</h2>
            <p style="color: #94a3b8; font-size: 14px;">Hello <b>${toName || 'Valued Customer'}</b>, your payment has been verified and your dedicated private DNS hostname is ready.</p>
            
            <div class="dns-box">
                <div style="font-size: 12px; text-transform: uppercase; color: #6ee7b7; font-weight: bold; margin-bottom: 5px;">Your Private DNS Hostname:</div>
                <div class="code-line">${orderDetails.dnsUrl}</div>
                <div style="margin-top: 10px; font-size: 13px; color: #cbd5e1;">
                    PIN: <b>${orderDetails.clientId}</b> | Validity: <b>${orderDetails.durationDays} Days</b> (Expires: ${orderDetails.expireDate || 'Active'})
                </div>
            </div>

            <h4 style="color: #fff; margin-bottom: 5px;">📱 Quick Setup:</h4>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
                <b>Android:</b> Phone Settings ➔ Connections ➔ More connection settings ➔ Private DNS ➔ Enter: <code style="color:#38bdf8;">${orderDetails.dnsUrl}</code><br>
                <b>iPhone / iPad:</b> Sign in to your account at our website to download your 1-Click iOS Apple Profile.
            </p>

            <div class="footer">
                &copy; ${new Date().getFullYear()} ${siteName}. Dedicated High-Speed DNS.
            </div>
        </div>
    </body>
    </html>
    `;

    return dispatchEmail(env, toEmail, toName, subject, htmlContent);
}

async function dispatchEmail(env, toEmail, toName, subject, htmlContent) {
    const provider = await getSetting(env, "email_provider", "none");
    const siteName = await getSetting(env, "site_name", "UltraDNS");

    if (provider === "none" || !provider) {
        return { success: false, skipped: true, error: "Email provider disabled" };
    }

    if (provider === "brevo") {
        const apiKey = await getSetting(env, "brevo_api_key", "");
        const senderEmail = await getSetting(env, "brevo_sender_email", "");
        const senderName = await getSetting(env, "brevo_sender_name", siteName);

        if (!apiKey || !senderEmail) {
            return { success: false, error: "Brevo credentials missing" };
        }

        try {
            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": apiKey,
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: toEmail, name: toName || toEmail }],
                    subject: subject,
                    htmlContent: htmlContent
                })
            });

            const data = await res.json();
            return { success: res.ok, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    return { success: true, provider: "relay" };
}
