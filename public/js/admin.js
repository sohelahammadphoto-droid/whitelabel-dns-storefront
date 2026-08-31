// public/js/admin.js — Reseller Admin Dashboard & Setup Wizard Logic
let authToken = localStorage.getItem("store_admin_token") || "";

document.addEventListener("DOMContentLoaded", () => {
    checkSetupStatus();
});

async function checkSetupStatus() {
    try {
        const res = await fetch("/api/admin/setup");
        const data = await res.json();

        if (data.success && data.needs_setup) {
            document.getElementById("login-screen").style.display = "none";
            document.getElementById("admin-app").style.display = "none";
            document.getElementById("setup-screen").style.display = "flex";
            return;
        }

        // Setup already completed
        document.getElementById("setup-screen").style.display = "none";
        if (authToken) {
            showDashboard();
        } else {
            document.getElementById("login-screen").style.display = "flex";
            document.getElementById("admin-app").style.display = "none";
        }
    } catch (e) {
        console.error("Check setup status error:", e);
        if (authToken) {
            showDashboard();
        }
    }
}

async function handleInitialSetup(e) {
    e.preventDefault();
    const btn = document.getElementById("setup-submit-btn");
    btn.disabled = true;
    btn.textContent = "Configuring Store & Testing API...";

    const payload = {
        admin_password: document.getElementById("setup-password").value.trim(),
        reseller_api_key: document.getElementById("setup-apikey").value.trim(),
        site_name: document.getElementById("setup-sitename").value.trim(),
        support_whatsapp: document.getElementById("setup-whatsapp").value.trim(),
        main_api_url: document.getElementById("setup-apiurl").value.trim()
    };

    try {
        const res = await fetch("/api/admin/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem("store_admin_token", authToken);
            alert("🎉 Setup Complete! Your store has been configured in your D1 Database.");
            document.getElementById("setup-screen").style.display = "none";
            showDashboard();
        } else {
            alert("❌ Setup Error: " + (data.error || "Failed to initialize store."));
        }
    } catch (err) {
        alert("❌ Connection error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Save & Launch Admin Dashboard";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const pass = document.getElementById("admin-pass").value.trim();
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Verifying...";

    try {
        const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pass })
        });
        const data = await res.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem("store_admin_token", authToken);
            showDashboard();
        } else {
            if (data.needs_setup) {
                return checkSetupStatus();
            }
            alert("❌ " + (data.error || "Invalid password"));
        }
    } catch (err) {
        alert("❌ Network error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Login to Dashboard";
    }
}

function handleLogout() {
    localStorage.removeItem("store_admin_token");
    authToken = "";
    document.getElementById("admin-app").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
}

function showDashboard() {
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-app").style.display = "flex";
    loadOrders();
    loadBalance();
    loadSettings();
}

async function loadBalance() {
    try {
        const res = await fetch("/api/admin/balance", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const json = await res.json();
        if (json.success) {
            const mainEl = document.getElementById("reseller-balance");
            const testEl = document.getElementById("reseller-test-balance");
            const testBadge = document.getElementById("test-pin-badge-count");

            if (mainEl) mainEl.textContent = `${json.credits} Credits`;
            if (testEl) testEl.textContent = `${json.test_credits} Avail`;
            if (testBadge) testBadge.textContent = `${json.test_credits} Test PINs Available`;
        }
    } catch (_) {}
}

function showTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
    document.querySelectorAll(".admin-nav-item").forEach(el => el.classList.remove("active"));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.style.display = "block";

    const titles = { 
        orders: "Orders & Sales", 
        testpin: "🧪 30-Minute Free Test PIN",
        generate: "⚡ Full Pass PIN Gen", 
        email: "📧 Gmail OTP & Verification Settings",
        settings: "⚙️ Store Settings" 
    };
    document.getElementById("page-title").textContent = titles[tabName] || "Dashboard";
}

// Global copy helper with instant visual feedback
window.copyToClipboard = function(text, btn, feedbackText = "✓ Copied!") {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const origHtml = btn.innerHTML;
            btn.innerHTML = feedbackText;
            btn.style.background = "#059669";
            btn.style.color = "#ffffff";
            setTimeout(() => {
                btn.innerHTML = origHtml;
                btn.style.background = "";
                btn.style.color = "";
            }, 2000);
        }
    }).catch(() => {
        prompt("Copy text manually:", text);
    });
};

function formatOrderWaMessage(o) {
    const clientId = o.client_id || o.username || "";
    const dnsUrl = o.dns_url || `${clientId}.dns.sohel.pp.ua`;
    const exp = o.expire_date || "30 Days";
    const iosUrl = `https://dnshub.pages.dev/api/public/ios-profile?username=${clientId}`;

    return `🎉 *DNS ACTIVATION COMPLETED* 🎉\n\n` +
        `👤 *Username / PIN:* \`${clientId}\`\n` +
        `🌐 *Private DNS Address:* \`${dnsUrl}\`\n` +
        `⏳ *Validity:* *${o.plan_name || 'Paid Plan'}* (Expires: ${exp})\n\n` +
        `📲 *Android Setup:* Settings ➔ Connections ➔ Private DNS ➔ Specified DNS ➔ Enter: \`${dnsUrl}\`\n` +
        `🍏 *iOS 1-Click Profile:* ${iosUrl}\n\n` +
        `🔥 Ultra-Fast Ad-Free Private DNS is now active for your device!`;
}

async function loadOrders() {
    const tbody = document.getElementById("orders-tbody");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading orders...</td></tr>`;

    try {
        const res = await fetch("/api/admin/orders", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const json = await res.json();

        if (!json.success) {
            if (res.status === 401) return handleLogout();
            tbody.innerHTML = `<tr><td colspan="7" style="color: #f87171;">Error: ${json.error}</td></tr>`;
            return;
        }

        const orders = json.data || [];
        updateStats(orders);

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No customer orders placed yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const cleanPhone = (o.customer_phone || "").replace(/[^0-9]/g, "");
            const waMsg = formatOrderWaMessage(o);
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;

            return `
            <tr>
                <td><b style="color:#fff;">${o.order_id}</b><br><span style="font-size:11px; color:var(--text-muted);">${o.created_at || ''}</span></td>
                <td><b>${o.customer_name}</b><br><span style="color:#38bdf8; font-size:12px;">${o.customer_phone}</span>${o.customer_email ? `<br><span style="color:#94a3b8; font-size:11px;">${o.customer_email}</span>` : ''}</td>
                <td>${o.plan_name}<br><b style="color:#fff;">${o.amount} ${o.currency}</b></td>
                <td><b>${o.payment_method}</b><br><code style="color:#a78bfa; font-size:11px;">${o.trx_id}</code></td>
                <td><span class="badge badge-${o.status}">${o.status}</span></td>
                <td>${o.client_id ? `<code style="color:#34d399; font-weight:800;">${o.client_id}</code>` : '<span style="color:var(--text-muted);">--</span>'}</td>
                <td>
                    ${o.status === 'pending' ? `
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button class="btn btn-success btn-sm" onclick="approveOrder('${o.order_id}')">✓ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectOrder('${o.order_id}')">✕</button>
                        </div>
                    ` : o.dns_url ? `
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button class="btn btn-primary btn-sm" onclick="copyToClipboard('${o.dns_url}', this, '✓ Host Copied')">📋 Copy DNS</button>
                            <button class="btn btn-success btn-sm" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(waMsg)}'), this, '✓ Msg Copied')">💬 Copy Msg</button>
                            <a href="${waLink}" target="_blank" class="btn btn-sm" style="background:#22c55e; color:#fff; text-decoration:none; display:inline-flex; align-items:center; padding:4px 8px; border-radius:6px;" title="Send WhatsApp">🚀</a>
                        </div>
                    ` : '<span style="color:var(--text-muted);">Done</span>'}
                </td>
            </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #f87171;">Failed to load orders: ${e.message}</td></tr>`;
    }
}

function updateStats(orders) {
    document.getElementById("stat-total").textContent = orders.length;
    document.getElementById("stat-pending").textContent = orders.filter(o => o.status === 'pending').length;
    document.getElementById("stat-approved").textContent = orders.filter(o => o.status === 'approved').length;
}

async function approveOrder(orderId) {
    if (!confirm(`Are you sure you want to approve Order ${orderId}? This will automatically deduct 1 credit from your Main API balance and generate the DNS PIN.`)) {
        return;
    }

    try {
        const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ order_id: orderId, action: "approve" })
        });
        const data = await res.json();

        if (data.success) {
            alert(`🎉 ${data.message}\n\nGenerated PIN: ${data.data.client_id}\nDNS Hostname: ${data.data.dns_url}`);
            loadOrders();
            loadBalance();
        } else {
            alert("❌ Approval failed: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        alert("❌ Error: " + e.message);
    }
}

async function rejectOrder(orderId) {
    if (!confirm(`Reject order ${orderId}?`)) return;
    try {
        const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ order_id: orderId, action: "reject" })
        });
        const data = await res.json();
        if (data.success) {
            alert("Order rejected.");
            loadOrders();
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// ----------------------------------------------------
// 30-Minute Test PIN Handler
// ----------------------------------------------------
async function handleGenerateTestPin(e) {
    e.preventDefault();
    const btn = document.getElementById("test-pin-submit-btn");
    btn.disabled = true;
    btn.textContent = "⚡ Generating 30-Min Trial...";

    const payload = {
        phone: document.getElementById("test-pin-phone").value.trim(),
        note: document.getElementById("test-pin-note").value.trim()
    };

    try {
        const res = await fetch("/api/admin/test-pin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        const resBox = document.getElementById("test-pin-result");
        resBox.style.display = "block";

        if (data.success) {
            const d = data.data;
            const cleanPhone = payload.phone.replace(/[^0-9]/g, "");
            const waMsg = d.whatsapp_share_text;
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;

            resBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                    <div style="color: #34d399; font-weight: 800; font-size: 16px;">🎉 30-Minute Test PIN Created!</div>
                    <span class="badge badge-approved">⚡ 30 MIN TRIAL</span>
                </div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.8; margin-bottom: 16px; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div>👤 Random Test PIN: <b style="color:#fff; font-size:15px; font-family:monospace;">${d.username}</b></div>
                    <div>🌐 DNS Hostname: <code style="color:#38bdf8; font-weight:bold; font-size:14px;">${d.dns_url}</code></div>
                    <div>⏱️ Validity: <b style="color:#fbbf24;">30 Minutes (${d.expires_at || 'Just Now'})</b></div>
                </div>
                <div style="display:flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary" onclick="copyToClipboard('${d.dns_url}', this, '✓ Hostname Copied!')" style="flex:1;">
                        📋 1. Copy Hostname
                    </button>
                    <button type="button" class="btn btn-success" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(waMsg)}'), this, '✓ Message Copied!')" style="flex:1;">
                        💬 2. Copy WhatsApp Msg
                    </button>
                    <a href="${waLink}" target="_blank" class="btn btn-sm" style="background:#22c55e; color:#fff; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:6px; font-weight:bold;">
                        🚀 Send
                    </a>
                </div>
            `;
            loadBalance();
            loadOrders();
        } else {
            resBox.innerHTML = `<div style="color: #f87171; font-weight:700;">❌ ${data.error || "Generation failed"}</div>`;
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate 30-Min Test PIN";
    }
}

// ----------------------------------------------------
// Full Pass Manual PIN Handler
// ----------------------------------------------------
async function handleManualGenerate(e) {
    e.preventDefault();
    const btn = document.getElementById("gen-submit-btn");
    btn.disabled = true;
    btn.textContent = "Generating...";

    const payload = {
        phone: document.getElementById("gen-phone").value.trim(),
        duration_days: parseInt(document.getElementById("gen-duration").value, 10),
        note: (document.getElementById("gen-note") ? document.getElementById("gen-note").value.trim() : "")
    };

    try {
        const res = await fetch("/api/admin/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        const resBox = document.getElementById("gen-result");
        resBox.style.display = "block";

        if (data.success) {
            const d = data.data;
            const cleanPhone = payload.phone.replace(/[^0-9]/g, "");
            const waMsg = d.whatsapp_share_text;
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;

            resBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                    <div style="color: #34d399; font-weight: 800; font-size: 16px;">🎉 DNS PIN Created Successfully!</div>
                    <span class="badge badge-approved">⚡ ${d.duration_days} DAYS</span>
                </div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.8; margin-bottom: 16px; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div>👤 Client PIN: <b style="color:#fff; font-size:15px; font-family:monospace;">${d.client_id}</b></div>
                    <div>🌐 DNS Hostname: <code style="color:#38bdf8; font-weight:bold; font-size:14px;">${d.dns_url}</code></div>
                    <div>📅 Expires At: <b style="color:#fbbf24;">${d.expire_date}</b></div>
                </div>
                <div style="display:flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary" onclick="copyToClipboard('${d.dns_url}', this, '✓ Hostname Copied!')" style="flex:1;">
                        📋 1. Copy Hostname
                    </button>
                    <button type="button" class="btn btn-success" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(waMsg)}'), this, '✓ Message Copied!')" style="flex:1;">
                        💬 2. Copy WhatsApp Msg
                    </button>
                    <a href="${waLink}" target="_blank" class="btn btn-sm" style="background:#22c55e; color:#fff; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:6px; font-weight:bold;">
                        🚀 Send
                    </a>
                </div>
            `;
            loadOrders();
            loadBalance();
        } else {
            resBox.innerHTML = `<div style="color: #f87171; font-weight:700;">❌ ${data.error || "Generation failed"}</div>`;
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate Paid DNS PIN";
    }
}

async function loadSettings() {
    try {
        const res = await fetch("/api/admin/settings", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            const s = json.data;
            if (s.reseller_api_key) document.getElementById("setting-apikey").value = s.reseller_api_key;
            if (s.main_api_url) document.getElementById("setting-apiurl").value = s.main_api_url;
            if (s.site_name) document.getElementById("setting-sitename").value = s.site_name;
            if (s.tagline) document.getElementById("setting-tagline").value = s.tagline;
            if (s.support_whatsapp) document.getElementById("setting-whatsapp").value = s.support_whatsapp;
            if (s.notice) document.getElementById("setting-notice").value = s.notice;

            // Email Settings
            if (s.email_provider) {
                document.getElementById("setting-emailprovider").value = s.email_provider;
            }
            if (s.brevo_api_key) document.getElementById("setting-brevoapikey").value = s.brevo_api_key;
            if (s.brevo_sender_email) document.getElementById("setting-brevosenderemail").value = s.brevo_sender_email;
            if (s.brevo_sender_name) document.getElementById("setting-brevosendername").value = s.brevo_sender_name;
            if (s.smtp_gmail_email) document.getElementById("setting-gmailemail").value = s.smtp_gmail_email;
            if (s.smtp_gmail_app_password) document.getElementById("setting-gmailapppassword").value = s.smtp_gmail_app_password;
            if (s.smtp_sender_name) document.getElementById("setting-gmailsendername").value = s.smtp_sender_name;

            // Anti-Bot & Turnstile Settings
            if (s.turnstile_site_key) document.getElementById("setting-turnstilesitekey").value = s.turnstile_site_key;
            if (s.turnstile_secret_key) document.getElementById("setting-turnstilesecretkey").value = s.turnstile_secret_key;

            toggleEmailProviderFields();
        }
    } catch (_) {}
}

function toggleEmailProviderFields() {
    const val = document.getElementById("setting-emailprovider").value;
    const boxBrevo = document.getElementById("box-brevo");
    const boxGmail = document.getElementById("box-gmail");

    if (boxBrevo) boxBrevo.style.display = (val === "brevo") ? "block" : "none";
    if (boxGmail) boxGmail.style.display = (val === "gmail_smtp") ? "block" : "none";
}

async function handleSaveEmailSettings(e) {
    e.preventDefault();
    const payload = {
        email_provider: document.getElementById("setting-emailprovider").value,
        brevo_api_key: document.getElementById("setting-brevoapikey").value.trim(),
        brevo_sender_email: document.getElementById("setting-brevosenderemail").value.trim(),
        brevo_sender_name: document.getElementById("setting-brevosendername").value.trim(),
        smtp_gmail_email: document.getElementById("setting-gmailemail").value.trim(),
        smtp_gmail_app_password: document.getElementById("setting-gmailapppassword").value.trim(),
        smtp_sender_name: document.getElementById("setting-gmailsendername").value.trim()
    };

    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ Email & OTP settings saved successfully to your D1 Database!");
            loadSettings();
        } else {
            alert("❌ Failed to save: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleSendTestEmail() {
    const email = document.getElementById("test-email-recipient").value.trim();
    const statusBox = document.getElementById("test-email-status");
    const btn = document.getElementById("test-email-btn");

    if (!email || !email.includes("@")) {
        alert("Please enter a valid recipient email");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sending Test OTP...";
    statusBox.style.display = "block";
    statusBox.style.color = "#fbbf24";
    statusBox.textContent = "Dispatching test email...";

    try {
        const res = await fetch("/api/admin/test-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ test_email: email })
        });
        const data = await res.json();

        if (data.success) {
            statusBox.style.color = "#34d399";
            statusBox.innerHTML = `✅ ${data.message}`;
        } else {
            statusBox.style.color = "#f87171";
            statusBox.innerHTML = `❌ ${data.error}`;
        }
    } catch (err) {
        statusBox.style.color = "#f87171";
        statusBox.textContent = "Error: " + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Test OTP";
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
        reseller_api_key: document.getElementById("setting-apikey").value.trim(),
        main_api_url: document.getElementById("setting-apiurl").value.trim(),
        site_name: document.getElementById("setting-sitename").value.trim(),
        tagline: document.getElementById("setting-tagline").value.trim(),
        support_whatsapp: document.getElementById("setting-whatsapp").value.trim(),
        notice: document.getElementById("setting-notice").value.trim(),
        turnstile_site_key: document.getElementById("setting-turnstilesitekey").value.trim(),
        turnstile_secret_key: document.getElementById("setting-turnstilesecretkey").value.trim()
    };

    const newPass = document.getElementById("setting-newpassword").value.trim();
    if (newPass) {
        payload.new_password = newPass;
    }

    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            if (newPass) {
                authToken = btoa(newPass + ":" + Date.now());
                localStorage.setItem("store_admin_token", authToken);
                document.getElementById("setting-newpassword").value = "";
            }
            alert("✅ Store settings saved successfully to your D1 Database!");
            loadSettings();
            loadBalance();
        } else {
            alert("❌ Failed to save: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
