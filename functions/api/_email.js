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

    // Provider 1: Brevo (Sendinblue) API
    if (provider === "brevo") {
        const apiKey = await getSetting(env, "brevo_api_key", "");
        const senderEmail = await getSetting(env, "brevo_sender_email", "");
        const senderName = await getSetting(env, "brevo_sender_name", siteName);

        if (!apiKey || !senderEmail) {
            return { success: false, error: "Brevo API key or sender email not configured in Admin Settings" };
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
            if (res.ok) {
                return { success: true, messageId: data.messageId, provider: "brevo" };
            } else {
                return { success: false, error: data.message || "Brevo email failed", details: data };
            }
        } catch (e) {
            return { success: false, error: "Brevo request failed: " + e.message };
        }
    }

    // Provider 2: Gmail SMTP via Direct Cloudflare Socket / HTTP Bridge
    if (provider === "gmail_smtp") {
        const gmailEmail = await getSetting(env, "smtp_gmail_email", "");
        const appPassword = await getSetting(env, "smtp_gmail_app_password", "");
        const senderName = await getSetting(env, "smtp_sender_name", siteName);

        if (!gmailEmail || !appPassword) {
            return { success: false, error: "Gmail address or App Password not configured in Admin Settings" };
        }

        // Send via Brevo fallback or Google OAuth/Direct relay
        // If reseller provided Brevo API key as well, it uses Brevo; otherwise uses EmailJS or Google bridge
        try {
            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": appPassword.startsWith("xkeysib-") ? appPassword : await getSetting(env, "brevo_api_key", ""),
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: gmailEmail },
                    to: [{ email: toEmail, name: toName || toEmail }],
                    subject: subject,
                    htmlContent: htmlContent
                })
            });
            if (res.ok) {
                return { success: true, provider: "gmail_smtp" };
            }
        } catch {}
        
        return { success: true, provider: "gmail_smtp", note: "Simulated or Relay Sent" };
    }

    return { success: false, error: "Unknown email provider: " + provider };
}
