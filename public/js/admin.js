let adminEmail = localStorage.getItem("admin_email") || "";
let adminPassword = localStorage.getItem("admin_password") || "";
let cachedSettings = {};
let currentFaqs = [];
let currentTestimonials = [];
let currentPaymentMethods = [];
let currentPlans = [];

document.addEventListener("DOMContentLoaded", () => {
    checkSetupStatus();
});

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword,
        "Authorization": `Bearer ${btoa((adminEmail || "admin") + ":" + adminPassword + ":storeadmin")}`
    };
}

// ----------------------------------------------------
// Setup Wizard & Authentication
// ----------------------------------------------------
async function checkSetupStatus() {
    try {
        const res = await fetch("/api/admin/setup");
        const data = await res.json();
        if (data.needsSetup || data.needs_setup) {
            document.getElementById("setup-screen").style.display = "flex";
            document.getElementById("login-screen").style.display = "none";
            document.getElementById("admin-app").style.display = "none";
        } else {
            document.getElementById("setup-screen").style.display = "none";
            if (adminPassword) {
                verifyAndLaunch();
            } else {
                document.getElementById("login-screen").style.display = "flex";
                document.getElementById("admin-app").style.display = "none";
            }
        }
    } catch {
        document.getElementById("login-screen").style.display = "flex";
    }
}

async function handleInitialSetup(e) {
    e.preventDefault();
    const btn = document.getElementById("setup-submit-btn");
    btn.disabled = true;
    btn.textContent = "Initializing Store...";

    const payload = {
        admin_email: document.getElementById("setup-email").value.trim().toLowerCase(),
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
            adminEmail = payload.admin_email;
            adminPassword = payload.admin_password;
            localStorage.setItem("admin_email", adminEmail);
            localStorage.setItem("admin_password", adminPassword);
            document.getElementById("setup-screen").style.display = "none";
            verifyAndLaunch();
        } else {
            alert("❌ Setup Error: " + (data.error || "Failed to initialize"));
            btn.disabled = false;
            btn.textContent = "✨ Save & Launch Admin Dashboard";
        }
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "✨ Save & Launch Admin Dashboard";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const email = (document.getElementById("admin-email")?.value || "").trim().toLowerCase();
    const pass = document.getElementById("admin-pass").value.trim();

    btn.disabled = true;
    btn.textContent = "Logging in...";

    try {
        const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: pass })
        });
        const data = await res.json();

        if (data.success) {
            adminEmail = email;
            adminPassword = pass;
            localStorage.setItem("admin_email", adminEmail);
            localStorage.setItem("admin_password", adminPassword);
            document.getElementById("login-screen").style.display = "none";
            verifyAndLaunch();
        } else {
            alert("❌ " + (data.error || "Invalid email or password"));
            if (data.needs_setup) {
                document.getElementById("login-screen").style.display = "none";
                document.getElementById("setup-screen").style.display = "flex";
            }
        }
    } catch (err) {
        alert("Login failed: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Login to Dashboard";
    }
}

function handleLogout() {
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_password");
    adminEmail = "";
    adminPassword = "";
    document.getElementById("admin-app").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
}

async function verifyAndLaunch() {
    try {
        const res = await fetch("/api/admin/orders", { headers: getHeaders() });
        if (res.status === 401) {
            handleLogout();
            return;
        }
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("admin-app").style.display = "flex";

        showTab("analytics");
        loadBalance();
        loadAnalytics();
        loadOrders();
        loadSettings();
    } catch {
        handleLogout();
    }
}

// ----------------------------------------------------
// Navigation Tab Switcher
// ----------------------------------------------------
function showTab(tabName) {
    const tabs = ["analytics", "orders", "payments", "plans", "customizer", "coupons", "staff", "testpin", "generate", "email", "settings"];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = (t === tabName) ? "block" : "none";
    });

    const items = document.querySelectorAll(".admin-nav-item");
    items.forEach((item, idx) => {
        if (idx < tabs.length) {
            item.classList.toggle("active", tabs[idx] === tabName);
        }
    });

    const titleEl = document.getElementById("page-title");
    const subEl = document.getElementById("page-subtitle");

    if (tabName === "analytics") {
        if (titleEl) titleEl.textContent = "Analytics & Insights";
        if (subEl) subEl.textContent = "Real-time revenue, conversion, and DNS operations";
        loadAnalytics();
    } else if (tabName === "orders") {
        if (titleEl) titleEl.textContent = "Orders & Sales";
        if (subEl) subEl.textContent = "Manage customer payments and DNS activations";
        loadOrders();
    } else if (tabName === "payments") {
        if (titleEl) titleEl.textContent = "Payment Gateways & Numbers";
        if (subEl) subEl.textContent = "Set up your bKash, Nagad, STC Pay, Urpay, Bank, and USDT accounts";
        renderAdminPaymentMethods();
    } else if (tabName === "plans") {
        if (titleEl) titleEl.textContent = "Pricing Packages & Plans";
        if (subEl) subEl.textContent = "Manage subscription packages, validity durations, prices, and features";
        renderAdminPlans();
    } else if (tabName === "customizer") {
        if (titleEl) titleEl.textContent = "Themes & Sections (Page Builder)";
        if (subEl) subEl.textContent = "Design studio, live colors, branding, and section visibility";
    } else if (tabName === "coupons") {
        if (titleEl) titleEl.textContent = "Discount Coupons";
        if (subEl) subEl.textContent = "Create promotional promo codes and discounts for customers";
        loadCoupons();
    } else if (tabName === "staff") {
        if (titleEl) titleEl.textContent = "Staff & Sub-Resellers";
        if (subEl) subEl.textContent = "Manage team members, roles, and sub-reseller accounts";
        loadStaff();
    } else if (tabName === "testpin") {
        if (titleEl) titleEl.textContent = "30-Min Test PIN Generator";
        if (subEl) subEl.textContent = "Generate instant free trials for potential customers";
    } else if (tabName === "generate") {
        if (titleEl) titleEl.textContent = "Full Pass PIN Generation";
        if (subEl) subEl.textContent = "Directly issue paid private DNS hostnames using your main balance";
    } else if (tabName === "email") {
        if (titleEl) titleEl.textContent = "Email & OTP Gateway";
        if (subEl) subEl.textContent = "Configure automated invoice and customer verification delivery";
    } else if (tabName === "settings") {
        if (subEl) subEl.textContent = "Telegram alerts, Reseller API key, and security";
    }
}

// ----------------------------------------------------
// 1. Analytics & Sales Dashboard
// ----------------------------------------------------
async function loadAnalytics() {
    try {
        const res = await fetch("/api/admin/analytics", { headers: getHeaders() });
        const json = await res.json();
        if (!json.success || !json.data) return;

        const d = json.data;
        const curSym = cachedSettings.currency_symbol || "﷼";

        const revEl = document.getElementById("analytic-revenue");
        const totEl = document.getElementById("analytic-total-orders");
        const convEl = document.getElementById("analytic-conversion");
        const custEl = document.getElementById("analytic-customers");

        if (revEl) revEl.textContent = `${d.total_revenue} ${curSym}`;
        if (totEl) totEl.textContent = d.total_orders;
        if (convEl) convEl.textContent = `${d.conversion_rate}%`;
        if (custEl) custEl.textContent = d.total_customers;

        // Render Bar Chart
        const chartBox = document.getElementById("analytics-chart-container");
        if (chartBox) {
            if (!d.recent_trend || d.recent_trend.length === 0) {
                chartBox.innerHTML = `<div style="text-align: center; width: 100%; color: var(--text-muted); padding: 40px 0;">No sales history in the past 7 days yet.</div>`;
            } else {
                const maxRev = Math.max(...d.recent_trend.map(t => t.revenue || 0), 1);
                chartBox.innerHTML = d.recent_trend.map(t => {
                    const heightPercent = Math.max(8, Math.round(((t.revenue || 0) / maxRev) * 100));
                    return `
                    <div class="bar-col">
                        <div style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 4px;">${t.revenue || 0}</div>
                        <div class="bar-fill" style="height: ${heightPercent}%;"></div>
                        <div class="bar-label">${t.date ? t.date.slice(5) : ''}<br><span style="color:#64748b;">(${t.count} ord)</span></div>
                    </div>
                    `;
                }).join('');
            }
        }

        // Render Top Plans
        const topPlansBox = document.getElementById("analytics-top-plans");
        if (topPlansBox) {
            if (!d.top_plans || d.top_plans.length === 0) {
                topPlansBox.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No approved orders yet</div>`;
            } else {
                topPlansBox.innerHTML = d.top_plans.map(p => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <b style="color: #fff;">${p.plan_name}</b>
                        <span style="font-size: 12px; color: #34d399; font-weight: 700;">${p.count} sold (${p.revenue} ${curSym})</span>
                    </div>
                `).join('');
            }
        }

        // Render Payment Methods
        const payMethodsBox = document.getElementById("analytics-payment-methods");
        if (payMethodsBox) {
            if (!d.payment_methods || d.payment_methods.length === 0) {
                payMethodsBox.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No payments recorded yet</div>`;
            } else {
                payMethodsBox.innerHTML = d.payment_methods.map(m => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <span style="color: #cbd5e1; font-weight: 600; text-transform: uppercase;">${m.payment_method}</span>
                        <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">${m.count} trx (${m.revenue} ${curSym})</span>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.error("Analytics fetch error:", e);
    }
}

// ----------------------------------------------------
// 2. Orders Management
// ----------------------------------------------------
async function loadOrders() {
    try {
        const res = await fetch("/api/admin/orders", { headers: getHeaders() });
        const json = await res.json();
        const tbody = document.getElementById("orders-tbody");

        if (!json.success || !json.data || json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No customer orders found.</td></tr>`;
            return;
        }

        tbody.innerHTML = json.data.map(o => `
            <tr>
                <td>
                    <b style="color:#fff;">${o.order_id}</b>
                    <div style="font-size: 11px; color: var(--text-muted);">${o.created_at || ''}</div>
                    <div style="margin-top: 4px;">
                        <a href="/api/invoice?id=${o.order_id}" target="_blank" style="color: #38bdf8; font-size: 11px; text-decoration: none; font-weight: 700;">
                            🧾 Invoice ↗
                        </a>
                    </div>
                </td>
                <td>
                    <b style="color:#cbd5e1;">${o.customer_name}</b>
                    <div style="font-size: 11px; color: #38bdf8;">${o.customer_phone}</div>
                    ${o.customer_email ? `<div style="font-size: 11px; color: var(--text-muted);">${o.customer_email}</div>` : ''}
                </td>
                <td>
                    <b>${o.plan_name}</b>
                    <div style="font-size: 11px; color: #34d399; font-weight: 700;">${o.amount} ${o.currency || 'SAR'}</div>
                </td>
                <td>
                    <span style="font-weight: 600; color: #cbd5e1; text-transform: uppercase;">${o.payment_method}</span>
                    <div style="font-size: 11px; color: #a5b4fc; font-family: monospace;">${o.trx_id}</div>
                </td>
                <td>
                    <span class="badge badge-${o.status}">${o.status}</span>
                </td>
                <td>
                    ${o.dns_url ? `
                        <div style="font-size: 12px; font-weight: 700; color: #38bdf8;">PIN: ${o.client_id}</div>
                        <div style="font-size: 11px; color: var(--text-muted); word-break: break-all;"><code>${o.dns_url}</code></div>
                    ` : '<span style="color: var(--text-muted); font-size: 12px;">--</span>'}
                </td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${o.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="approveOrder('${o.order_id}')">✓ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectOrder('${o.order_id}')">✕ Reject</button>
                        ` : ''}
                        ${o.status === 'approved' && o.dns_url ? `
                            <button class="btn btn-secondary btn-sm" onclick="shareWhatsApp('${o.order_id}', '${o.customer_phone}', '${o.client_id}', '${o.dns_url}', '${o.duration_days}')">
                                💬 WhatsApp
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Failed to load orders:", e);
    }
}

async function approveOrder(orderId) {
    if (!confirm(`Approve order ${orderId} and issue DNS access from balance?`)) return;

    try {
        const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ order_id: orderId, action: "approve" })
        });
        const json = await res.json();

        if (json.success) {
            alert("🎉 " + json.message);
            loadOrders();
            loadBalance();
            loadAnalytics();
        } else {
            alert("❌ Failed to approve: " + (json.error || "Unknown error"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function rejectOrder(orderId) {
    if (!confirm(`Reject order ${orderId}?`)) return;

    try {
        const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ order_id: orderId, action: "reject" })
        });
        const json = await res.json();
        if (json.success) {
            loadOrders();
            loadAnalytics();
        } else {
            alert("❌ " + json.error);
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

function shareWhatsApp(orderId, phone, clientId, dnsUrl, duration) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
        `🎉 *Your Private DNS is Active!*\n\n` +
        `👤 *PIN:* \`${clientId}\`\n` +
        `🌐 *DNS Address:* \`${dnsUrl}\`\n` +
        `⏳ *Duration:* ${duration} Days\n\n` +
        `📱 *Android Setup:* Settings ➔ Connections ➔ Private DNS ➔ \`${dnsUrl}\`\n` +
        `🍏 *iPhone / iPad:* Sign in at our website to download 1-Click Profile\n\n` +
        `🧾 *Invoice:* ${window.location.origin}/api/invoice?id=${orderId}`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`, '_blank');
}

async function loadBalance() {
    try {
        const res = await fetch("/api/admin/balance", { headers: getHeaders() });
        const json = await res.json();
        const balEl = document.getElementById("reseller-balance");
        const testBalEl = document.getElementById("reseller-test-balance");
        const testBadge = document.getElementById("test-pin-badge-count");
        
        if (json.success) {
            const d = json.data || json;
            const credits = d.credits !== undefined ? d.credits : (d.balance !== undefined ? d.balance : 0);
            const testPins = d.test_pins !== undefined ? d.test_pins : (d.test_credits !== undefined ? d.test_credits : 0);
            
            if (balEl) balEl.textContent = `${credits} Credits`;
            if (testBalEl) testBalEl.textContent = `${testPins} Avail`;
            if (testBadge) testBadge.textContent = `${testPins} Available`;
        } else {
            if (balEl) balEl.textContent = "0 Credits";
            if (testBalEl) testBalEl.textContent = "0 Avail";
            if (testBadge) testBadge.textContent = "0 Available";
        }
    } catch (e) {
        console.error("Balance fetch error:", e);
    }
}

// ----------------------------------------------------
// 3. Page Builder & Design Customizer
// ----------------------------------------------------
async function loadSettings() {
    try {
        const res = await fetch("/api/admin/settings", { headers: getHeaders() });
        const json = await res.json();
        if (!json.success || !json.data) return;

        cachedSettings = json.data;
        const d = json.data;

        // Theme colors & mode
        setVal("custom-theme-primary", d.theme_primary || "#6366f1");
        setVal("custom-theme-primary-hex", d.theme_primary || "#6366f1");
        setVal("custom-theme-accent", d.theme_accent || "#06b6d4");
        setVal("custom-theme-accent-hex", d.theme_accent || "#06b6d4");
        setVal("custom-theme-bgmode", d.theme_bg_mode || "cyber");

        // Section toggles
        setCheck("toggle-notice", d.show_notice !== false);
        setCheck("toggle-hero", d.show_hero !== false);
        setCheck("toggle-stats", d.show_stats !== false);
        setCheck("toggle-features", d.show_features !== false);
        setCheck("toggle-pricing", d.show_pricing !== false);
        setCheck("toggle-checker", d.show_checker !== false);
        setCheck("toggle-testimonials", d.show_testimonials !== false);
        setCheck("toggle-faq", d.show_faq !== false);
        setCheck("toggle-guide", d.show_guide !== false);
        setCheck("toggle-customhtml", Boolean(d.show_custom_html));

        // Branding & Currency
        setVal("custom-sitename", d.site_name || "UltraDNS Pro");
        setVal("custom-sitebadge", d.site_badge || "PRO");
        setVal("custom-sitelogo", d.site_logo || "");
        setVal("custom-sitefavicon", d.site_favicon || "");
        setVal("custom-ownername", d.owner_name || "Premium Services");
        setVal("custom-currency", d.currency || "BDT");

        // Hero & Notice
        setVal("custom-notice", d.notice || "");
        setVal("custom-heropill", d.hero_pill_text || "");
        setVal("custom-herotitle1", d.hero_title_line1 || "");
        setVal("custom-herotitle2", d.hero_title_line2 || "");
        setVal("custom-herosubtitle", d.hero_subtitle || "");
        setVal("custom-btnherobuy", d.btn_hero_buy_text || "");
        setVal("custom-btnherocheck", d.btn_hero_check_text || "");

        // Custom Code
        setVal("custom-html-code", d.custom_html || "");
        setVal("custom-css-code", d.custom_css || "");
        setVal("custom-js-code", d.custom_js || "");

        // Socials & Support
        setVal("custom-whatsapp", d.support_whatsapp || "");
        setVal("custom-telegram", d.support_telegram || "");
        setVal("custom-whatsappmsg", d.support_whatsapp_msg || "");

        // Telegram Alerts
        setVal("setting-telegrambottoken", d.telegram_bot_token || "");
        setVal("setting-telegramchatid", d.telegram_chat_id || "");

        // API & Security
        setVal("setting-apikey", d.reseller_api_key || "");
        setVal("setting-apiurl", d.main_api_url || "https://dnshub.pages.dev");
        setVal("setting-turnstilesitekey", d.turnstile_site_key || "");
        setVal("setting-turnstilesecretkey", d.turnstile_secret_key || "");

        // Email settings
        setVal("setting-emailprovider", d.email_provider || "none");
        setVal("setting-brevoapikey", d.brevo_api_key || "");
        setVal("setting-brevosenderemail", d.brevo_sender_email || "");
        setVal("setting-brevosendername", d.brevo_sender_name || "");
        toggleEmailProviderFields();

        // Payment methods
        currentPaymentMethods = d.payment_methods || [];
        renderAdminPaymentMethods();

        // Pricing plans
        currentPlans = d.plans || [];
        renderAdminPlans();

        // FAQ items
        currentFaqs = d.faqs || [];
        renderAdminFaqs();

        // Testimonials
        currentTestimonials = d.testimonials || [];
        renderAdminTestimonials();
    } catch (e) {
        console.error("Settings load error:", e);
    }
}

// ----------------------------------------------------
// 💳 Payment Methods Visual Manager
// ----------------------------------------------------
function renderAdminPaymentMethods() {
    const container = document.getElementById("payment-methods-admin-container");
    if (!container) return;

    if (currentPaymentMethods.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 30px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                No payment methods added yet. Click <b>"+ Add Payment Method"</b> above to add bKash, Nagad, STC Pay, etc.
            </div>`;
        return;
    }

    container.innerHTML = currentPaymentMethods.map((m, i) => `
        <div class="dynamic-item-card" style="background: rgba(18, 26, 43, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px;">
            <div class="dynamic-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 8px;">
                <span style="font-weight: 800; color: #38bdf8; font-size: 13px;">💳 Payment Method #${i + 1}</span>
                <button type="button" class="btn-delete-item" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px;" onclick="deletePaymentMethod(${i})">✕ Delete</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Method Name *</label>
                    <input type="text" class="form-control" placeholder="e.g. bKash (Send Money) or STC Pay" value="${m.name || ''}" oninput="currentPaymentMethods[${i}].name = this.value; currentPaymentMethods[${i}].id = (currentPaymentMethods[${i}].id || this.value.toLowerCase().replace(/[^a-z0-9]/g, ''))">
                </div>
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Number / Wallet Address *</label>
                    <input type="text" class="form-control" placeholder="e.g. 01700000000 or Wallet Address" value="${m.number || ''}" oninput="currentPaymentMethods[${i}].number = this.value">
                </div>
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Account Type / Name</label>
                    <input type="text" class="form-control" placeholder="e.g. Personal / Merchant" value="${m.account_name || ''}" oninput="currentPaymentMethods[${i}].account_name = this.value">
                </div>
            </div>
            <div>
                <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Customer Instructions / Note</label>
                <input type="text" class="form-control" placeholder="e.g. Send Money to this bKash number and paste the TrxID below." value="${m.instructions || ''}" oninput="currentPaymentMethods[${i}].instructions = this.value">
            </div>
        </div>
    `).join('');
}

window.addPaymentMethod = function() {
    currentPaymentMethods.push({
        id: "method_" + Date.now(),
        name: "New Payment Method",
        number: "01700000000",
        account_name: "Personal",
        instructions: "Send payment to this account and copy TrxID."
    });
    renderAdminPaymentMethods();
};

window.deletePaymentMethod = function(idx) {
    if (confirm("Are you sure you want to delete this payment method?")) {
        currentPaymentMethods.splice(idx, 1);
        renderAdminPaymentMethods();
    }
};

window.savePaymentMethods = async function() {
    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ payment_methods: currentPaymentMethods })
        });
        const json = await res.json();
        if (json.success) {
            alert("🎉 Payment methods saved successfully! Customer checkout updated.");
        } else {
            alert("❌ " + json.error);
        }
    } catch (e) {
        alert("Error saving payment methods: " + e.message);
    }
};

// ----------------------------------------------------
// 📦 Pricing Packages Visual Manager
// ----------------------------------------------------
function renderAdminPlans() {
    const container = document.getElementById("plans-admin-container");
    if (!container) return;

    if (currentPlans.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 30px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                No pricing packages configured. Click <b>"+ Add New Package"</b> above.
            </div>`;
        return;
    }

    container.innerHTML = currentPlans.map((p, i) => `
        <div class="dynamic-item-card" style="background: rgba(18, 26, 43, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px;">
            <div class="dynamic-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 8px;">
                <span style="font-weight: 800; color: #a78bfa; font-size: 13px;">📦 Package #${i + 1}</span>
                <button type="button" class="btn-delete-item" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px;" onclick="deletePlanItem(${i})">✕ Delete</button>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Package Name *</label>
                    <input type="text" class="form-control" placeholder="e.g. 1 Month VIP Pass" value="${p.name || ''}" oninput="currentPlans[${i}].name = this.value; currentPlans[${i}].id = (currentPlans[${i}].id || 'plan_' + (i+1))">
                </div>
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Duration (Days) *</label>
                    <input type="number" class="form-control" placeholder="30" value="${p.duration_days || 30}" min="1" oninput="currentPlans[${i}].duration_days = parseInt(this.value) || 30">
                </div>
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Price (Store Currency) *</label>
                    <input type="number" class="form-control" placeholder="15" value="${p.price || 0}" min="0" step="any" oninput="currentPlans[${i}].price = parseFloat(this.value) || 0">
                </div>
                <div>
                    <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Badge (Optional)</label>
                    <input type="text" class="form-control" placeholder="MOST POPULAR" value="${p.badge || ''}" oninput="currentPlans[${i}].badge = this.value; currentPlans[${i}].popular = Boolean(this.value)">
                </div>
            </div>
            <div>
                <label style="display:block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Features (Comma separated)</label>
                <input type="text" class="form-control" placeholder="30 Days Validity, All Banking Apps, Zero Speed Drop, 24/7 Support" value="${Array.isArray(p.features) ? p.features.join(', ') : (p.features || '')}" oninput="currentPlans[${i}].features = this.value.split(',').map(s => s.trim()).filter(Boolean)">
            </div>
        </div>
    `).join('');
}

window.addPlanItem = function() {
    currentPlans.push({
        id: "plan_" + Date.now(),
        name: "New Custom Pass",
        duration_days: 30,
        price: 20,
        popular: false,
        badge: "",
        features: ["30 Days Validity", "All Banking Apps Unlocked", "Zero Speed Drop", "Dedicated Support"]
    });
    renderAdminPlans();
};

window.deletePlanItem = function(idx) {
    if (confirm("Are you sure you want to delete this package?")) {
        currentPlans.splice(idx, 1);
        renderAdminPlans();
    }
};

window.savePlans = async function() {
    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ plans: currentPlans })
        });
        const json = await res.json();
        if (json.success) {
            alert("🎉 Pricing packages saved successfully! Storefront updated.");
        } else {
            alert("❌ " + json.error);
        }
    } catch (e) {
        alert("Error saving plans: " + e.message);
    }
};

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function setCheck(id, bool) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(bool);
}

// 🎨 Theme Presets Click
function applyColorPreset(primary, accent, bgMode) {
    setVal("custom-theme-primary", primary);
    setVal("custom-theme-primary-hex", primary);
    setVal("custom-theme-accent", accent);
    setVal("custom-theme-accent-hex", accent);
    setVal("custom-theme-bgmode", bgMode);
}

function updateColorInputs(type) {
    if (type === 'primary') {
        const val = document.getElementById("custom-theme-primary").value;
        setVal("custom-theme-primary-hex", val);
    } else {
        const val = document.getElementById("custom-theme-accent").value;
        setVal("custom-theme-accent-hex", val);
    }
}

function updateColorPickers(type) {
    if (type === 'primary') {
        const val = document.getElementById("custom-theme-primary-hex").value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) setVal("custom-theme-primary", val);
    } else {
        const val = document.getElementById("custom-theme-accent-hex").value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) setVal("custom-theme-accent", val);
    }
}

// ❓ FAQ Visual Manager in Admin
function renderAdminFaqs() {
    const container = document.getElementById("faq-items-admin-container");
    if (!container) return;

    if (currentFaqs.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">No FAQs configured. Click "+ Add FAQ Item" to create one.</div>`;
        return;
    }

    container.innerHTML = currentFaqs.map((f, i) => `
        <div class="dynamic-item-card">
            <div class="dynamic-item-header">
                <span style="font-weight: 700; color: #fbbf24; font-size: 12px;">FAQ #${i + 1}</span>
                <button type="button" class="btn-delete-item" onclick="deleteFaqItem(${i})">✕ Delete</button>
            </div>
            <div class="form-group">
                <input type="text" class="form-control" placeholder="Question" value="${f.q || ''}" oninput="currentFaqs[${i}].q = this.value">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <textarea class="form-control" rows="2" placeholder="Answer" oninput="currentFaqs[${i}].a = this.value">${f.a || ''}</textarea>
            </div>
        </div>
    `).join('');
}

window.addFaqItem = function() {
    currentFaqs.push({ q: "New Question?", a: "Answer here..." });
    renderAdminFaqs();
};

window.deleteFaqItem = function(idx) {
    currentFaqs.splice(idx, 1);
    renderAdminFaqs();
};

// ⭐ Testimonials Visual Manager in Admin
function renderAdminTestimonials() {
    const container = document.getElementById("testimonial-items-admin-container");
    if (!container) return;

    if (currentTestimonials.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">No reviews configured. Click "+ Add Review Item" to create one.</div>`;
        return;
    }

    container.innerHTML = currentTestimonials.map((t, i) => `
        <div class="dynamic-item-card">
            <div class="dynamic-item-header">
                <span style="font-weight: 700; color: #60a5fa; font-size: 12px;">Review #${i + 1}</span>
                <button type="button" class="btn-delete-item" onclick="deleteTestimonialItem(${i})">✕ Delete</button>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 8px;">
                <input type="text" class="form-control" placeholder="Customer Name" value="${t.name || ''}" oninput="currentTestimonials[${i}].name = this.value">
                <input type="text" class="form-control" placeholder="Location/Country" value="${t.role || ''}" oninput="currentTestimonials[${i}].role = this.value">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <textarea class="form-control" rows="2" placeholder="Customer Review Feedback" oninput="currentTestimonials[${i}].text = this.value">${t.text || ''}</textarea>
            </div>
        </div>
    `).join('');
}

window.addTestimonialItem = function() {
    currentTestimonials.push({ name: "Customer Name", role: "Saudi Arabia", rating: 5, text: "Great speed and instant activation!" });
    renderAdminTestimonials();
};

window.deleteTestimonialItem = function(idx) {
    currentTestimonials.splice(idx, 1);
    renderAdminTestimonials();
};

// 💾 Save All Customizer & Design Changes
async function handleSaveCustomizer(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById("customizer-save-btn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Saving Studio Changes...";
    }

    const payload = {
        theme_primary: document.getElementById("custom-theme-primary").value,
        theme_accent: document.getElementById("custom-theme-accent").value,
        theme_bg_mode: document.getElementById("custom-theme-bgmode").value,

        show_notice: document.getElementById("toggle-notice").checked,
        show_hero: document.getElementById("toggle-hero").checked,
        show_stats: document.getElementById("toggle-stats").checked,
        show_features: document.getElementById("toggle-features").checked,
        show_pricing: document.getElementById("toggle-pricing").checked,
        show_checker: document.getElementById("toggle-checker").checked,
        show_testimonials: document.getElementById("toggle-testimonials").checked,
        show_faq: document.getElementById("toggle-faq").checked,
        show_guide: document.getElementById("toggle-guide").checked,
        show_custom_html: document.getElementById("toggle-customhtml").checked,

        site_name: document.getElementById("custom-sitename").value.trim(),
        site_badge: document.getElementById("custom-sitebadge").value.trim(),
        site_logo: document.getElementById("custom-sitelogo").value.trim(),
        site_favicon: document.getElementById("custom-sitefavicon").value.trim(),
        owner_name: document.getElementById("custom-ownername").value.trim(),
        currency: document.getElementById("custom-currency") ? document.getElementById("custom-currency").value : "BDT",

        notice: document.getElementById("custom-notice").value.trim(),
        hero_pill_text: document.getElementById("custom-heropill").value.trim(),
        hero_title_line1: document.getElementById("custom-herotitle1").value.trim(),
        hero_title_line2: document.getElementById("custom-herotitle2").value.trim(),
        hero_subtitle: document.getElementById("custom-herosubtitle").value.trim(),
        btn_hero_buy_text: document.getElementById("custom-btnherobuy").value.trim(),
        btn_hero_check_text: document.getElementById("custom-btnherocheck").value.trim(),

        faqs: currentFaqs,
        testimonials: currentTestimonials,

        custom_html: document.getElementById("custom-html-code").value.trim(),
        custom_css: document.getElementById("custom-css-code").value.trim(),
        custom_js: document.getElementById("custom-js-code").value.trim(),

        support_whatsapp: document.getElementById("custom-whatsapp").value.trim(),
        support_telegram: document.getElementById("custom-telegram").value.trim(),
        support_whatsapp_msg: document.getElementById("custom-whatsappmsg").value.trim()
    };

    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            alert("🎉 Design studio and section settings saved successfully!");
        } else {
            alert("❌ " + json.error);
        }
    } catch (err) {
        alert("Save failed: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "💾 Save All Page & Theme Changes";
        }
    }
}

// ----------------------------------------------------
// 4. Discount Coupons Management
// ----------------------------------------------------
async function loadCoupons() {
    try {
        const res = await fetch("/api/admin/coupons", { headers: getHeaders() });
        const json = await res.json();
        const tbody = document.getElementById("coupons-tbody");
        if (!tbody) return;

        if (!json.success || !json.data || json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No discount coupons created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = json.data.map(c => `
            <tr>
                <td><b style="color:#38bdf8; font-family:monospace; font-size:14px;">${c.code}</b></td>
                <td><b>${c.discount_val}${c.discount_type === 'percent' ? '%' : ' ' + (cachedSettings.currency || 'SAR')}</b></td>
                <td>${c.used_count} / ${c.max_uses > 0 ? c.max_uses : '∞'}</td>
                <td><span class="badge ${c.status === 'active' ? 'badge-approved' : 'badge-rejected'}">${c.status}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteCoupon(${c.id})">✕ Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Coupons load error:", e);
    }
}

async function handleCreateCoupon(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-save-coupon");
    btn.disabled = true;
    btn.textContent = "Creating...";

    const payload = {
        code: document.getElementById("coupon-code").value.trim().toUpperCase(),
        discount_type: document.getElementById("coupon-type").value,
        discount_val: parseFloat(document.getElementById("coupon-val").value),
        min_amount: parseFloat(document.getElementById("coupon-min").value) || 0,
        max_uses: parseInt(document.getElementById("coupon-maxuses").value, 10) || 0,
        expires_at: document.getElementById("coupon-expires").value || null,
        status: "active"
    };

    try {
        const res = await fetch("/api/admin/coupons", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            alert("🎉 Coupon created successfully!");
            document.getElementById("coupon-code").value = "";
            document.getElementById("coupon-val").value = "";
            loadCoupons();
        } else {
            alert("❌ " + json.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Create Coupon";
    }
}

async function deleteCoupon(id) {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
        const res = await fetch(`/api/admin/coupons?id=${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        const json = await res.json();
        if (json.success) {
            loadCoupons();
        } else {
            alert("❌ " + json.error);
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// ----------------------------------------------------
// 5. Staff & Sub-Reseller Management
// ----------------------------------------------------
async function loadStaff() {
    try {
        const res = await fetch("/api/admin/staff", { headers: getHeaders() });
        const json = await res.json();
        const tbody = document.getElementById("staff-tbody");
        if (!tbody) return;

        if (!json.success || !json.data || json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No staff or agent accounts yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = json.data.map(s => `
            <tr>
                <td>
                    <b style="color:#fff;">${s.name}</b>
                    <div style="font-size:11px; color:#38bdf8;">@${s.username}</div>
                </td>
                <td><span style="text-transform:uppercase; font-weight:700; color:#cbd5e1; font-size:11px;">${s.role}</span></td>
                <td><span class="badge badge-approved">${s.status}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteStaff(${s.id})">✕ Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Staff load error:", e);
    }
}

async function handleCreateStaff(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-save-staff");
    btn.disabled = true;
    btn.textContent = "Creating Account...";

    const payload = {
        name: document.getElementById("staff-name").value.trim(),
        username: document.getElementById("staff-username").value.trim(),
        password: document.getElementById("staff-password").value.trim(),
        role: document.getElementById("staff-role").value
    };

    try {
        const res = await fetch("/api/admin/staff", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            alert("🎉 " + json.message);
            document.getElementById("staff-name").value = "";
            document.getElementById("staff-username").value = "";
            document.getElementById("staff-password").value = "";
            loadStaff();
        } else {
            alert("❌ " + json.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Create Staff Member";
    }
}

async function deleteStaff(id) {
    if (!confirm("Are you sure you want to delete this staff member?")) return;

    try {
        const res = await fetch(`/api/admin/staff?id=${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        const json = await res.json();
        if (json.success) {
            loadStaff();
        } else {
            alert("❌ " + json.error);
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// ----------------------------------------------------
// 6. Test PIN & Full PIN Generators
// ----------------------------------------------------
async function handleGenerateTestPin(e) {
    e.preventDefault();
    const btn = document.getElementById("test-pin-submit-btn");
    const resultBox = document.getElementById("test-pin-result");

    btn.disabled = true;
    btn.textContent = "Generating 30-Min PIN...";
    resultBox.style.display = "none";

    const payload = {
        phone: document.getElementById("test-pin-phone").value.trim(),
        note: document.getElementById("test-pin-note").value.trim()
    };

    try {
        const res = await fetch("/api/admin/test-pin", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        resultBox.style.display = "block";
        if (json.success && json.data) {
            const d = json.data;
            resultBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 8px;">🎉 30-Min Test PIN Generated!</div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.7;">
                    <div>👤 <b>PIN / User:</b> <code style="color: #38bdf8; font-size: 14px;">${d.client_id}</code></div>
                    <div>🌐 <b>DNS Host:</b> <code>${d.dns_url}</code></div>
                    <div>⏳ <b>Validity:</b> 30 Minutes (Expires: ${d.expire_date || 'In 30 mins'})</div>
                </div>
                <div style="margin-top: 14px; display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${d.dns_url}').then(() => alert('Copied: ${d.dns_url}'))">
                        📋 Copy Hostname
                    </button>
                    ${payload.phone ? `
                        <button class="btn btn-success btn-sm" onclick="shareWhatsApp('TEST', '${payload.phone}', '${d.client_id}', '${d.dns_url}', '0.5 Hours')">
                            💬 Send via WhatsApp
                        </button>
                    ` : ''}
                </div>
            `;
            loadBalance();
        } else {
            resultBox.innerHTML = `<div style="color: #f87171;">❌ ${json.error || "Failed to generate test PIN"}</div>`;
        }
    } catch (err) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `<div style="color: #f87171;">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate 30-Min Test PIN";
    }
}

async function handleManualGenerate(e) {
    e.preventDefault();
    const btn = document.getElementById("gen-submit-btn");
    const resultBox = document.getElementById("gen-result");

    btn.disabled = true;
    btn.textContent = "Generating Paid PIN...";
    resultBox.style.display = "none";

    const payload = {
        phone: document.getElementById("gen-phone").value.trim(),
        duration_days: parseInt(document.getElementById("gen-duration").value, 10),
        note: document.getElementById("gen-note").value.trim()
    };

    try {
        const res = await fetch("/api/admin/generate", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        resultBox.style.display = "block";
        if (json.success && json.data) {
            const d = json.data;
            resultBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 8px;">🎉 Paid DNS PIN Generated!</div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.7;">
                    <div>👤 <b>PIN / User:</b> <code style="color: #38bdf8; font-size: 14px;">${d.client_id}</code></div>
                    <div>🌐 <b>DNS Host:</b> <code>${d.dns_url}</code></div>
                    <div>⏳ <b>Validity:</b> ${payload.duration_days} Days (Expires: ${d.expire_date || 'Active'})</div>
                </div>
            `;
            loadBalance();
        } else {
            resultBox.innerHTML = `<div style="color: #f87171;">❌ ${json.error}</div>`;
        }
    } catch (err) {
        resultBox.style.display = "block";
        resultBox.innerHTML = `<div style="color: #f87171;">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate Paid DNS PIN";
    }
}

// ----------------------------------------------------
// 7. Email Settings & Live Tester
// ----------------------------------------------------
function toggleEmailProviderFields() {
    const prov = document.getElementById("setting-emailprovider").value;
    const brevoBox = document.getElementById("box-brevo");
    if (brevoBox) brevoBox.style.display = (prov === "brevo") ? "block" : "none";
}

async function handleSaveEmailSettings(e) {
    e.preventDefault();
    const payload = {
        email_provider: document.getElementById("setting-emailprovider").value,
        brevo_api_key: document.getElementById("setting-brevoapikey").value.trim(),
        brevo_sender_email: document.getElementById("setting-brevosenderemail").value.trim(),
        brevo_sender_name: document.getElementById("setting-brevosendername").value.trim()
    };

    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            alert("🎉 Email & notification settings saved!");
        } else {
            alert("❌ " + json.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleSendTestEmail() {
    const btn = document.getElementById("test-email-btn");
    const status = document.getElementById("test-email-status");
    const email = document.getElementById("test-email-recipient").value.trim();

    if (!email) {
        alert("Please enter a recipient email address");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sending...";
    status.style.display = "none";

    try {
        const res = await fetch("/api/admin/test-email", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ email: email })
        });
        const json = await res.json();

        status.style.display = "block";
        if (json.success) {
            status.style.color = "#34d399";
            status.textContent = `✓ Test email sent successfully to ${email}! Check inbox.`;
        } else {
            status.style.color = "#f87171";
            status.textContent = `❌ Failed: ${json.error || "Check your credentials"}`;
        }
    } catch (e) {
        status.style.display = "block";
        status.style.color = "#f87171";
        status.textContent = "Error: " + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Test Email";
    }
}

async function handleSendTestTelegram() {
    const btn = document.getElementById("test-telegram-btn");
    const status = document.getElementById("test-telegram-status");
    const botToken = document.getElementById("setting-telegrambottoken").value.trim();
    const chatId = document.getElementById("setting-telegramchatid").value.trim();

    if (!botToken || !chatId) {
        alert("Please enter both Telegram Bot Token and Admin Chat ID first.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sending Test Alert...";
    status.style.display = "none";

    try {
        const res = await fetch("/api/admin/test-telegram", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ bot_token: botToken, chat_id: chatId })
        });
        let json = null;
        try {
            json = await res.json();
        } catch {
            json = { success: false, error: `Server returned HTTP ${res.status}. Deployment may still be building.` };
        }

        status.style.display = "inline-block";
        if (json.success) {
            status.style.color = "#34d399";
            status.textContent = "✓ Test alert sent! Check your Telegram.";
        } else {
            status.style.color = "#f87171";
            status.textContent = `❌ ${json.error || "Failed to send alert"}`;
        }
    } catch (e) {
        status.style.display = "inline-block";
        status.style.color = "#f87171";
        status.textContent = "Error: " + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = "🧪 Send Test Telegram Alert";
    }
}

// ----------------------------------------------------
// 8. Core API & Alert Settings Save
// ----------------------------------------------------
async function handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
        reseller_api_key: document.getElementById("setting-apikey").value.trim(),
        main_api_url: document.getElementById("setting-apiurl").value.trim(),
        telegram_bot_token: document.getElementById("setting-telegrambottoken").value.trim(),
        telegram_chat_id: document.getElementById("setting-telegramchatid").value.trim(),
        new_password: document.getElementById("setting-newpassword").value.trim(),
        turnstile_site_key: document.getElementById("setting-turnstilesitekey").value.trim(),
        turnstile_secret_key: document.getElementById("setting-turnstilesecretkey").value.trim()
    };

    try {
        const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            alert("🎉 Core settings saved successfully!");
            if (payload.new_password) {
                adminPassword = payload.new_password;
                localStorage.setItem("admin_password", adminPassword);
                document.getElementById("setting-newpassword").value = "";
            }
        } else {
            alert("❌ " + json.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
