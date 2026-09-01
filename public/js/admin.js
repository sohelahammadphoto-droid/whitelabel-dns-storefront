// public/js/admin.js — Reseller Storefront Admin Dashboard & Customizer Logic
let authToken = localStorage.getItem("store_admin_token") || "";

document.addEventListener("DOMContentLoaded", () => {
    checkFirstTimeSetup();
});

async function checkFirstTimeSetup() {
    try {
        const res = await fetch("/api/admin/check-setup");
        const json = await res.json();
        if (json.isFirstTime) {
            document.getElementById("setup-screen").style.display = "flex";
            document.getElementById("login-screen").style.display = "none";
            document.getElementById("admin-app").style.display = "none";
            return;
        }
    } catch (_) {}

    if (authToken) {
        verifySession();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("admin-app").style.display = "none";
}

async function verifySession() {
    try {
        const res = await fetch("/api/admin/orders", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (res.status === 401) {
            handleLogout();
            return;
        }
        initDashboard();
    } catch (e) {
        handleLogout();
    }
}

async function handleInitialSetup(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("setup-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Setting up store...";

    const payload = {
        admin_password: document.getElementById("setup-password").value.trim(),
        reseller_api_key: document.getElementById("setup-apikey").value.trim(),
        site_name: document.getElementById("setup-sitename").value.trim(),
        support_whatsapp: document.getElementById("setup-whatsapp").value.trim(),
        main_api_url: document.getElementById("setup-apiurl").value.trim()
    };

    try {
        const res = await fetch("/api/admin/initial-setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.token) {
            authToken = data.token;
            localStorage.setItem("store_admin_token", authToken);
            alert("🎉 Store initialized successfully! Welcome to your Admin Dashboard.");
            initDashboard();
        } else {
            alert("❌ Setup failed: " + (data.error || "Unknown error"));
            submitBtn.disabled = false;
            submitBtn.textContent = "✨ Save & Launch Admin Dashboard";
        }
    } catch (err) {
        alert("Error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "✨ Save & Launch Admin Dashboard";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const pass = document.getElementById("admin-pass").value;
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Verifying...";

    authToken = btoa(pass + ":" + Date.now());

    try {
        const res = await fetch("/api/admin/orders", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const data = await res.json();

        if (res.ok && data.success) {
            localStorage.setItem("store_admin_token", authToken);
            initDashboard();
        } else {
            alert("❌ Invalid Admin Password");
            authToken = "";
            localStorage.removeItem("store_admin_token");
        }
    } catch (err) {
        alert("Login error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Login to Dashboard";
    }
}

function handleLogout() {
    authToken = "";
    localStorage.removeItem("store_admin_token");
    showLoginScreen();
}

function initDashboard() {
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

    // Set active tab in sidebar
    const tabsMap = {
        orders: 0,
        customizer: 1,
        testpin: 2,
        generate: 3,
        email: 4,
        settings: 5
    };
    const navItems = document.querySelectorAll(".admin-nav-item");
    if (navItems[tabsMap[tabName]]) {
        navItems[tabsMap[tabName]].classList.add("active");
    }

    const titles = { 
        orders: { title: "Orders & Sales", subtitle: "Manage customer payments and DNS activations" },
        customizer: { title: "🎨 Theme & Content Customizer", subtitle: "Customize colors, headings, button names, and announcements" },
        testpin: { title: "🧪 30-Minute Free Test PIN", subtitle: "Generate instant 30-min trial PINs for prospective customers" },
        generate: { title: "⚡ Full Pass PIN Gen", subtitle: "Create long-term DNS PINs directly from API balance" },
        email: { title: "📧 Gmail OTP & Verification", subtitle: "Configure Brevo or Gmail SMTP verification for signups" },
        settings: { title: "⚙️ Store & API Settings", subtitle: "Manage API keys, admin password, and anti-bot security" }
    };

    const t = titles[tabName] || { title: "Dashboard", subtitle: "" };
    document.getElementById("page-title").textContent = t.title;
    document.getElementById("page-subtitle").textContent = t.subtitle;
}

// Global copy helper with instant visual feedback
window.copyToClipboard = function(text, btn, feedbackText = "✓ Copied!") {
    if (!navigator.clipboard) {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
    } else {
        navigator.clipboard.writeText(text);
    }
    
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = feedbackText;
        btn.style.borderColor = "#10b981";
        btn.style.color = "#34d399";
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.borderColor = "";
            btn.style.color = "";
        }, 2200);
    }
};

// -------------------------------------------------------------
// Orders Management
// -------------------------------------------------------------
async function loadOrders() {
    const tbody = document.getElementById("orders-tbody");
    try {
        const res = await fetch("/api/admin/orders", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const json = await res.json();

        if (json.success) {
            const orders = json.data || [];
            
            // Update Stats
            document.getElementById("stat-total").textContent = orders.length;
            document.getElementById("stat-pending").textContent = orders.filter(o => o.status === "pending").length;
            document.getElementById("stat-approved").textContent = orders.filter(o => o.status === "approved").length;

            if (orders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No customer orders yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = orders.map(o => {
                const statusBadge = {
                    pending: `<span class="badge badge-pending">⏳ Pending</span>`,
                    approved: `<span class="badge badge-approved">✓ Approved</span>`,
                    rejected: `<span class="badge badge-rejected">✕ Rejected</span>`
                }[o.status] || o.status;

                let actionBtn = "";
                if (o.status === "pending") {
                    actionBtn = `
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-success btn-sm" onclick="handleOrderAction('${o.order_id}', 'approve')">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="handleOrderAction('${o.order_id}', 'reject')">Reject</button>
                        </div>
                    `;
                } else if (o.status === "approved") {
                    const cleanPhone = (o.customer_phone || "").replace(/[^0-9]/g, "");
                    const waShareMsg = `🎉 *DNS ACTIVATION COMPLETED* 🎉\n\n👤 *Username / PIN:* \`${o.client_id || 'N/A'}\`\n🌐 *Private DNS Address:* \`${o.dns_url || `${o.client_id}.dnsbd.pp.ua`}\`\n⏳ *Validity:* *${o.duration_days || 30} Days* (Expires: ${o.expire_date || 'N/A'})\n\n📲 *Android Setup:* Settings ➔ Connections ➔ Private DNS ➔ Specified DNS ➔ Enter: \`${o.dns_url || `${o.client_id}.dnsbd.pp.ua`}\`\n🍏 *iOS Profile:* https://dnshub.pages.dev/api/public/ios-profile?username=${o.client_id}\n\n🔥 Ultra-Fast Ad-Free Private DNS is active for your device!`;
                    const waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waShareMsg)}`;
                    const safeDns = (o.dns_url || `${o.client_id}.dnsbd.pp.ua`).replace(/'/g, "\\'");
                    const safeWa = waShareMsg.replace(/'/g, "\\'").replace(/\n/g, "\\n");

                    actionBtn = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; gap: 4px;">
                                <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeDns}', this, '✓ Copied!')" title="Copy DNS Hostname">📋 DNS</button>
                                <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeWa}', this, '✓ Copied!')" title="Copy Formatted WhatsApp Message">💬 Msg</button>
                                ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn btn-success btn-sm" title="Send directly to WhatsApp">🚀 Send</a>` : ''}
                            </div>
                        </div>
                    `;
                } else {
                    actionBtn = `<span style="color: var(--text-muted); font-size: 12px;">Closed</span>`;
                }

                return `
                    <tr>
                        <td>
                            <b>${o.order_id}</b>
                            <div style="font-size: 11px; color: var(--text-muted);">${new Date(o.created_at || Date.now()).toLocaleDateString()}</div>
                        </td>
                        <td>
                            <div><b>${o.customer_name}</b></div>
                            <div style="font-size: 12px; color: var(--text-muted);">${o.customer_phone}</div>
                        </td>
                        <td>
                            <div>${o.plan_name}</div>
                            <div style="font-size: 12px; color: #38bdf8; font-weight: 700;">${o.amount} ${o.currency}</div>
                        </td>
                        <td>
                            <div><b>${o.payment_method}</b></div>
                            <div style="font-size: 11px; color: #a5b4fc;"><code>${o.trx_id}</code></div>
                        </td>
                        <td>${statusBadge}</td>
                        <td>
                            ${o.client_id ? `
                                <div><b style="color: #38bdf8;">${o.client_id}</b></div>
                                <div style="font-size: 11px; color: var(--text-muted);">${o.dns_url || ''}</div>
                            ` : '<span style="color: var(--text-muted);">-</span>'}
                        </td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #f87171; text-align: center;">Error loading orders: ${e.message}</td></tr>`;
    }
}

async function handleOrderAction(orderId, action) {
    if (!confirm(`Are you sure you want to ${action.toUpperCase()} order ${orderId}?`)) return;

    try {
        const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ order_id: orderId, action })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Order ${orderId} has been ${action}ed!`);
            loadOrders();
            loadBalance();
        } else {
            alert("❌ Failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        alert("Action Error: " + err.message);
    }
}

// -------------------------------------------------------------
// 30-Minute Test PIN Generator
// -------------------------------------------------------------
async function handleGenerateTestPin(e) {
    e.preventDefault();
    const btn = document.getElementById("test-pin-submit-btn");
    const resultBox = document.getElementById("test-pin-result");
    const phone = document.getElementById("test-pin-phone").value.trim();
    const note = document.getElementById("test-pin-note").value.trim();

    btn.disabled = true;
    btn.textContent = "Generating Trial PIN...";
    resultBox.style.display = "none";

    try {
        const res = await fetch("/api/admin/test-pin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ phone, note })
        });
        const data = await res.json();

        if (data.success && data.data) {
            const pin = data.data;
            const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
            const waShareMsg = pin.whatsapp_share_text || `⚡ *30-MIN PRIVATE DNS TEST PIN*\n\n👤 *Username:* \`${pin.username}\`\n⏱️ *Duration:* 30 Minutes\n🌐 *DNS Hostname:* \`${pin.dns_url}\`\n\n📲 *Android:* Settings ➔ Connections ➔ Private DNS ➔ \`${pin.dns_url}\``;
            const waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waShareMsg)}`;
            const safeDns = (pin.dns_url || '').replace(/'/g, "\\'");
            const safeWa = waShareMsg.replace(/'/g, "\\'").replace(/\n/g, "\\n");

            resultBox.style.display = "block";
            resultBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>✓</span> 30-Minute Test PIN Generated!
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="margin-bottom: 8px;"><span style="color: var(--text-muted); font-size: 12px;">Assigned PIN:</span> <b style="color: #38bdf8; font-size: 16px; font-family: monospace;">${pin.username}</b></div>
                    <div style="margin-bottom: 8px;"><span style="color: var(--text-muted); font-size: 12px;">DNS Hostname:</span> <b style="color: #fff; font-size: 14px; font-family: monospace;">${pin.dns_url}</b></div>
                    <div><span style="color: var(--text-muted); font-size: 12px;">Valid For:</span> <span style="color: #fbbf24; font-weight: 700;">30 Minutes</span></div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeDns}', this, '✓ Copied Hostname!')">📋 1. Copy Hostname</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeWa}', this, '✓ Copied WhatsApp Msg!')">💬 2. Copy WhatsApp Msg</button>
                    ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn btn-success btn-sm">🚀 Send to WhatsApp</a>` : ''}
                </div>
            `;
            loadBalance();
            loadOrders();
        } else {
            alert("❌ Generation failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate 30-Min Test PIN";
    }
}

// -------------------------------------------------------------
// Full Pass PIN Generation
// -------------------------------------------------------------
async function handleManualGenerate(e) {
    e.preventDefault();
    const btn = document.getElementById("gen-submit-btn");
    const resultBox = document.getElementById("gen-result");
    const phone = document.getElementById("gen-phone").value.trim();
    const duration = document.getElementById("gen-duration").value;
    const note = document.getElementById("gen-note").value.trim();

    btn.disabled = true;
    btn.textContent = "Generating Paid PIN...";
    resultBox.style.display = "none";

    try {
        const res = await fetch("/api/admin/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ phone, duration_days: duration, note })
        });
        const data = await res.json();

        if (data.success && data.data) {
            const client = data.data;
            const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
            const waShareMsg = client.whatsapp_share_text || `🎉 *DNS ACTIVATION COMPLETED* 🎉\n\n👤 *Username / PIN:* \`${client.username}\`\n🌐 *Private DNS Address:* \`${client.dns_url}\`\n⏳ *Validity:* *${client.duration_days} Days* (Expires: ${client.expire_date || 'N/A'})\n\n📲 *Android Setup:* Settings ➔ Connections ➔ Private DNS ➔ Specified DNS ➔ Enter: \`${client.dns_url}\`\n🍏 *iOS Profile:* https://dnshub.pages.dev/api/public/ios-profile?username=${client.username}\n\n🔥 Ultra-Fast Ad-Free Private DNS is active for your device!`;
            const waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waShareMsg)}`;
            const safeDns = (client.dns_url || '').replace(/'/g, "\\'");
            const safeWa = waShareMsg.replace(/'/g, "\\'").replace(/\n/g, "\\n");

            resultBox.style.display = "block";
            resultBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>✓</span> Paid DNS PIN Created Successfully!
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="margin-bottom: 8px;"><span style="color: var(--text-muted); font-size: 12px;">Assigned PIN:</span> <b style="color: #38bdf8; font-size: 16px; font-family: monospace;">${client.username}</b></div>
                    <div style="margin-bottom: 8px;"><span style="color: var(--text-muted); font-size: 12px;">DNS Hostname:</span> <b style="color: #fff; font-size: 14px; font-family: monospace;">${client.dns_url}</b></div>
                    <div><span style="color: var(--text-muted); font-size: 12px;">Expires At:</span> <span style="color: #fbbf24; font-weight: 700;">${client.expire_date} (${client.duration_days} Days)</span></div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeDns}', this, '✓ Copied Hostname!')">📋 1. Copy Hostname</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyToClipboard('${safeWa}', this, '✓ Copied WhatsApp Msg!')">💬 2. Copy WhatsApp Msg</button>
                    ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn btn-success btn-sm">🚀 Send to WhatsApp</a>` : ''}
                </div>
            `;
            loadBalance();
            loadOrders();
        } else {
            alert("❌ Generation failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate Paid DNS PIN";
    }
}

// -------------------------------------------------------------
// 🎨 Theme & Content Customizer Logic
// -------------------------------------------------------------
function applyColorPreset(primary, accent, bgMode) {
    document.getElementById("custom-theme-primary").value = primary;
    document.getElementById("custom-theme-primary-hex").value = primary;
    document.getElementById("custom-theme-accent").value = accent;
    document.getElementById("custom-theme-accent-hex").value = accent;
    document.getElementById("custom-theme-bgmode").value = bgMode;
}

function updateColorInputs(type) {
    if (type === "primary") {
        document.getElementById("custom-theme-primary-hex").value = document.getElementById("custom-theme-primary").value;
    } else if (type === "accent") {
        document.getElementById("custom-theme-accent-hex").value = document.getElementById("custom-theme-accent").value;
    }
}

function updateColorPickers(type) {
    if (type === "primary") {
        const val = document.getElementById("custom-theme-primary-hex").value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            document.getElementById("custom-theme-primary").value = val;
        }
    } else if (type === "accent") {
        const val = document.getElementById("custom-theme-accent-hex").value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            document.getElementById("custom-theme-accent").value = val;
        }
    }
}

async function handleSaveCustomizer(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById("customizer-save-btn");
    btn.disabled = true;
    btn.textContent = "Saving Design & Texts...";

    const payload = {
        // Colors & Theme
        theme_primary: document.getElementById("custom-theme-primary-hex").value.trim(),
        theme_accent: document.getElementById("custom-theme-accent-hex").value.trim(),
        theme_bg_mode: document.getElementById("custom-theme-bgmode").value,
        
        // Brand & Identity
        site_name: document.getElementById("custom-sitename").value.trim(),
        site_badge: document.getElementById("custom-sitebadge").value.trim(),
        tagline: document.getElementById("custom-tagline").value.trim(),

        // Hero Content
        hero_pill_text: document.getElementById("custom-heropill").value.trim(),
        hero_title_line1: document.getElementById("custom-herotitle1").value.trim(),
        hero_title_line2: document.getElementById("custom-herotitle2").value.trim(),
        hero_subtitle: document.getElementById("custom-herosubtitle").value.trim(),
        btn_hero_buy_text: document.getElementById("custom-btnherobuy").value.trim(),
        btn_hero_check_text: document.getElementById("custom-btnherocheck").value.trim(),

        // Notice Bar
        notice_enabled: document.getElementById("custom-noticeenabled").checked,
        notice: document.getElementById("custom-notice").value.trim(),

        // Section Titles & Buttons
        pricing_title: document.getElementById("custom-pricingtitle").value.trim(),
        btn_plan_card_text: document.getElementById("custom-btnplancard").value.trim(),
        checker_title: document.getElementById("custom-checkertitle").value.trim(),
        btn_checker_text: document.getElementById("custom-btnchecker").value.trim(),
        checker_input_placeholder: document.getElementById("custom-checkerplaceholder").value.trim(),

        // Floating Support & Links
        floating_support_enabled: document.getElementById("custom-floatingsupport").checked,
        support_whatsapp: document.getElementById("custom-whatsapp").value.trim(),
        support_whatsapp_msg: document.getElementById("custom-whatsappmsg").value.trim(),
        support_telegram: document.getElementById("custom-telegram").value.trim(),
        owner_name: document.getElementById("custom-ownername").value.trim()
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
            alert("🎨 Store design, colors & custom texts saved live to your D1 Database!");
            loadSettings();
        } else {
            alert("❌ Failed to save: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "💾 Save All Customizer & Design Changes";
    }
}

// -------------------------------------------------------------
// Settings Load
// -------------------------------------------------------------
async function loadSettings() {
    try {
        const res = await fetch("/api/admin/settings", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            const s = json.data;

            // Core Settings Tab
            if (s.reseller_api_key) document.getElementById("setting-apikey").value = s.reseller_api_key;
            if (s.main_api_url) document.getElementById("setting-apiurl").value = s.main_api_url;

            // Email & OTP Tab
            if (s.email_provider) document.getElementById("setting-emailprovider").value = s.email_provider;
            if (s.brevo_api_key) document.getElementById("setting-brevoapikey").value = s.brevo_api_key;
            if (s.brevo_sender_email) document.getElementById("setting-brevosenderemail").value = s.brevo_sender_email;
            if (s.brevo_sender_name) document.getElementById("setting-brevosendername").value = s.brevo_sender_name;
            if (s.smtp_gmail_email) document.getElementById("setting-gmailemail").value = s.smtp_gmail_email;
            if (s.smtp_gmail_app_password) document.getElementById("setting-gmailapppassword").value = s.smtp_gmail_app_password;
            if (s.smtp_sender_name) document.getElementById("setting-gmailsendername").value = s.smtp_sender_name;
            if (s.turnstile_site_key) document.getElementById("setting-turnstilesitekey").value = s.turnstile_site_key;
            if (s.turnstile_secret_key) document.getElementById("setting-turnstilesecretkey").value = s.turnstile_secret_key;
            toggleEmailProviderFields();

            // Customizer Tab Fields
            if (s.theme_primary) {
                document.getElementById("custom-theme-primary").value = s.theme_primary;
                document.getElementById("custom-theme-primary-hex").value = s.theme_primary;
            }
            if (s.theme_accent) {
                document.getElementById("custom-theme-accent").value = s.theme_accent;
                document.getElementById("custom-theme-accent-hex").value = s.theme_accent;
            }
            if (s.theme_bg_mode) document.getElementById("custom-theme-bgmode").value = s.theme_bg_mode;

            if (s.site_name) document.getElementById("custom-sitename").value = s.site_name;
            if (s.site_badge) document.getElementById("custom-sitebadge").value = s.site_badge;
            if (s.tagline) document.getElementById("custom-tagline").value = s.tagline;

            if (s.hero_pill_text) document.getElementById("custom-heropill").value = s.hero_pill_text;
            if (s.hero_title_line1) document.getElementById("custom-herotitle1").value = s.hero_title_line1;
            if (s.hero_title_line2) document.getElementById("custom-herotitle2").value = s.hero_title_line2;
            if (s.hero_subtitle) document.getElementById("custom-herosubtitle").value = s.hero_subtitle;
            if (s.btn_hero_buy_text) document.getElementById("custom-btnherobuy").value = s.btn_hero_buy_text;
            if (s.btn_hero_check_text) document.getElementById("custom-btnherocheck").value = s.btn_hero_check_text;

            document.getElementById("custom-noticeenabled").checked = s.notice_enabled !== undefined ? Boolean(s.notice_enabled) : true;
            if (s.notice) document.getElementById("custom-notice").value = s.notice;

            if (s.pricing_title) document.getElementById("custom-pricingtitle").value = s.pricing_title;
            if (s.btn_plan_card_text) document.getElementById("custom-btnplancard").value = s.btn_plan_card_text;
            if (s.checker_title) document.getElementById("custom-checkertitle").value = s.checker_title;
            if (s.btn_checker_text) document.getElementById("custom-btnchecker").value = s.btn_checker_text;
            if (s.checker_input_placeholder) document.getElementById("custom-checkerplaceholder").value = s.checker_input_placeholder;

            document.getElementById("custom-floatingsupport").checked = s.floating_support_enabled !== undefined ? Boolean(s.floating_support_enabled) : true;
            if (s.support_whatsapp) document.getElementById("custom-whatsapp").value = s.support_whatsapp;
            if (s.support_whatsapp_msg) document.getElementById("custom-whatsappmsg").value = s.support_whatsapp_msg;
            if (s.support_telegram) document.getElementById("custom-telegram").value = s.support_telegram;
            if (s.owner_name) document.getElementById("custom-ownername").value = s.owner_name;
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
            alert("✅ Store & API settings saved successfully to your D1 Database!");
            loadSettings();
            loadBalance();
        } else {
            alert("❌ Failed to save: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
