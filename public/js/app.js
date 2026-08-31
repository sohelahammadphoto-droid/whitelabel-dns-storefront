// public/js/app.js — Customer Storefront & Account Dashboard Logic
let siteConfig = null;
let currentPlan = null;
let customerToken = localStorage.getItem("customer_token") || "";
let customerUser = JSON.parse(localStorage.getItem("customer_user") || "null");

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("footer-year").textContent = new Date().getFullYear();
    loadSiteConfig();
    renderNavbarAuth();
    if (customerToken) {
        fetchCustomerData();
    }
});

// Load dynamic config from D1 Database
async function loadSiteConfig() {
    try {
        const res = await fetch("/api/config");
        const json = await res.json();
        if (json.success && json.data) {
            siteConfig = json.data;
            renderConfig();
        }
    } catch (e) {
        console.error("Failed to load config:", e);
    }
}

function renderConfig() {
    if (!siteConfig) return;

    if (siteConfig.site_name) {
        document.getElementById("site-name").textContent = siteConfig.site_name;
        document.title = `${siteConfig.site_name} — High Speed & Banking DNS Access`;
    }
    if (siteConfig.tagline) {
        document.getElementById("tagline").textContent = siteConfig.tagline;
    }
    if (siteConfig.notice) {
        document.getElementById("notice-text").textContent = siteConfig.notice;
    }
    if (siteConfig.owner_name) {
        document.getElementById("footer-owner").textContent = siteConfig.owner_name;
    }
    if (siteConfig.support_whatsapp) {
        const cleanWa = siteConfig.support_whatsapp.replace(/[^0-9]/g, "");
        document.getElementById("whatsapp-link").href = `https://wa.me/${cleanWa}?text=Hello,%20I%20need%20assistance%20with%20Private%20DNS`;
    }

    renderPlans();
    renderPaymentMethods();
}

function renderPlans() {
    const container = document.getElementById("plans-container");
    if (!siteConfig || !siteConfig.plans) return;

    container.innerHTML = siteConfig.plans.map(p => `
        <div class="pricing-card ${p.popular ? 'popular' : ''}">
            ${p.badge ? `<div class="card-badge">${p.badge}</div>` : ''}
            <div class="card-plan-name">${p.name}</div>
            <div class="price-wrap">
                <span class="price-val">${p.price}</span>
                <span class="price-cur">${siteConfig.currency_symbol || '﷼'}</span>
                <span class="price-period">/ ${p.duration_days} Days</span>
            </div>
            <ul class="feature-list">
                ${(p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('')}
            </ul>
            <button class="plan-btn ${p.popular ? 'plan-btn-popular' : ''}" onclick="openOrderModal('${p.id}')">
                ⚡ Get Instant Access
            </button>
        </div>
    `).join('');
}

function renderPaymentMethods() {
    const select = document.getElementById("order-payment-method");
    if (!siteConfig || !siteConfig.payment_methods) return;

    select.innerHTML = siteConfig.payment_methods.map(m => `
        <option value="${m.id}">${m.name} (${m.number})</option>
    `).join('');
    updatePaymentInstruction();
}

function updatePaymentInstruction() {
    const select = document.getElementById("order-payment-method");
    if (!siteConfig || !siteConfig.payment_methods) return;

    const selected = siteConfig.payment_methods.find(m => m.id === select.value) || siteConfig.payment_methods[0];
    if (selected) {
        document.getElementById("payment-instruction-text").textContent = selected.instructions || `Send payment to ${selected.name} number below and enter TrxID.`;
        document.getElementById("payment-number-display").textContent = `${selected.number} (${selected.account_name || 'Personal'})`;
    }
}

function copyPaymentNumber() {
    const numText = document.getElementById("payment-number-display").textContent.split(' ')[0];
    navigator.clipboard.writeText(numText).then(() => {
        alert("Payment number copied: " + numText);
    });
}

// ----------------------------------------------------
// Customer Authentication & Navbar Handling
// ----------------------------------------------------
function renderNavbarAuth() {
    const container = document.getElementById("nav-auth-container");
    if (!container) return;

    if (customerToken && customerUser) {
        container.innerHTML = `
            <div class="user-btn-wrap">
                <button class="user-pill" onclick="openUserModal()">
                    <span>👤</span> <span>${customerUser.name.split(' ')[0]}</span>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="nav-btn" onclick="openAuthModal()">🔑 Sign In</button>
        `;
    }
}

function openAuthModal(defaultTab = 'login') {
    document.getElementById("auth-modal").classList.add("active");
    switchAuthTab(defaultTab);
}

function closeAuthModal() {
    document.getElementById("auth-modal").classList.remove("active");
}

let pendingOtpEmail = "";
let resendTimer = null;

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    const isRegister = tab === 'register';
    const isOtp = tab === 'otp';

    document.getElementById("tab-login-btn").classList.toggle("active", isLogin);
    document.getElementById("tab-register-btn").classList.toggle("active", isRegister);
    
    document.getElementById("login-form").style.display = isLogin ? "block" : "none";
    document.getElementById("register-form").style.display = isRegister ? "block" : "none";
    document.getElementById("otp-form").style.display = isOtp ? "block" : "none";
}

async function handleCustomerLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-submit-btn");
    btn.disabled = true;
    btn.textContent = "Signing In...";

    const payload = {
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value
    };

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            customerToken = data.token;
            customerUser = data.user;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));
            
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (data.error || "Login failed"));
        }
    } catch (err) {
        alert("❌ Connection error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Sign In to Account";
    }
}

async function handleCustomerRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("reg-submit-btn");
    btn.disabled = true;
    btn.textContent = "Processing...";

    const payload = {
        name: document.getElementById("reg-name").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        phone: document.getElementById("reg-phone").value.trim(),
        password: document.getElementById("reg-password").value
    };

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            if (data.needs_otp) {
                // Switch to OTP screen
                pendingOtpEmail = data.email || payload.email;
                document.getElementById("otp-display-email").textContent = pendingOtpEmail;
                document.getElementById("otp-input-code").value = "";
                switchAuthTab('otp');
                startResendCooldown();
                alert(`📧 ${data.message}`);
                return;
            }

            // Direct signup without OTP
            customerToken = data.token;
            customerUser = data.user;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));

            alert("🎉 Account created successfully!");
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (data.error || "Registration failed"));
        }
    } catch (err) {
        alert("❌ Connection error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✨ Create Account";
    }
}

async function handleVerifyOtp(e) {
    e.preventDefault();
    const btn = document.getElementById("otp-submit-btn");
    const code = document.getElementById("otp-input-code").value.trim();

    if (!code || code.length !== 6) {
        alert("Please enter the 6-digit verification code");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Verifying Code...";

    try {
        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail, otp_code: code })
        });
        const data = await res.json();

        if (data.success) {
            customerToken = data.token;
            customerUser = data.user;
            localStorage.setItem("customer_token", customerToken);
            localStorage.setItem("customer_user", JSON.stringify(customerUser));

            alert("🎉 " + data.message);
            closeAuthModal();
            renderNavbarAuth();
            openUserModal();
        } else {
            alert("❌ " + (data.error || "Verification failed"));
        }
    } catch (err) {
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✓ Verify & Activate Account";
    }
}

async function handleResendOtp() {
    if (!pendingOtpEmail) return;
    const btn = document.getElementById("otp-resend-btn");
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await fetch("/api/auth/resend-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail })
        });
        const data = await res.json();
        if (data.success) {
            alert("📧 " + data.message);
            startResendCooldown();
        } else {
            alert("❌ " + data.error);
            btn.disabled = false;
            btn.textContent = "Resend Code";
        }
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Resend Code";
    }
}

function startResendCooldown() {
    const btn = document.getElementById("otp-resend-btn");
    if (!btn) return;
    let seconds = 60;
    btn.disabled = true;
    if (resendTimer) clearInterval(resendTimer);

    resendTimer = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            btn.textContent = `Resend in ${seconds}s`;
        } else {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.textContent = "Resend Code";
        }
    }, 1000);
}

function handleCustomerLogout() {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_user");
    customerToken = "";
    customerUser = null;
    closeUserModal();
    renderNavbarAuth();
    alert("You have logged out.");
}

// ----------------------------------------------------
// Customer Account Dashboard & Active DNS Fetching
// ----------------------------------------------------
async function openUserModal() {
    if (!customerToken) {
        return openAuthModal();
    }
    document.getElementById("user-modal").classList.add("active");
    document.getElementById("user-display-name").textContent = customerUser ? customerUser.name : "My Account";
    document.getElementById("user-display-email").textContent = customerUser ? customerUser.email : "";
    fetchCustomerData();
}

function closeUserModal() {
    document.getElementById("user-modal").classList.remove("active");
}

async function fetchCustomerData() {
    try {
        const res = await fetch("/api/user/me", {
            headers: { "Authorization": `Bearer ${customerToken}` }
        });
        const data = await res.json();

        if (!data.success) {
            if (res.status === 401) {
                handleCustomerLogout();
            }
            return;
        }

        renderActiveServices(data.active_services || []);
        renderOrderHistory(data.orders || []);
    } catch (e) {
        console.error("fetchCustomerData error:", e);
    }
}

function renderActiveServices(services) {
    const container = document.getElementById("user-active-services");
    if (!services || services.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); padding: 15px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 13px;">
                No active DNS connection yet. Your DNS will appear here automatically once your payment is verified!
            </div>
        `;
        return;
    }

    container.innerHTML = services.map(s => `
        <div class="active-dns-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                    <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 700;">🟢 ACTIVE</span>
                    <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">PIN: <b style="color:#fff;">${s.client_id}</b></span>
                </div>
                <span style="font-size: 12px; color: #fbbf24; font-weight: 600;">${s.expire_date ? 'Expires: ' + s.expire_date.split('T')[0] : s.plan_name}</span>
            </div>

            <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06);">
                ${s.dns_url}
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="navigator.clipboard.writeText('${s.dns_url}').then(() => alert('Copied DNS Hostname: ${s.dns_url}'))">
                    📋 Copy Hostname (Android)
                </button>
                <button type="button" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="downloadIosProfile('${s.client_id}', '${s.dns_url}')">
                    🍎 Download iOS Profile (.mobileconfig)
                </button>
            </div>
        </div>
    `).join('');
}

function renderOrderHistory(orders) {
    const container = document.getElementById("user-order-history");
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">No orders yet.</div>`;
        return;
    }

    container.innerHTML = orders.map(o => {
        const statusColors = { pending: "#fbbf24", approved: "#34d399", rejected: "#f87171" };
        return `
            <div class="order-history-item">
                <div>
                    <div style="font-weight: 700; font-size: 13px; color: #fff;">${o.plan_name} (${o.amount} ${o.currency})</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${o.order_id} • Trx: ${o.trx_id}</div>
                </div>
                <div style="text-align: right;">
                    <span style="color: ${statusColors[o.status] || '#fff'}; font-weight: 800; font-size: 12px; text-transform: uppercase;">
                        ${o.status}
                    </span>
                    <div style="font-size: 10px; color: var(--text-muted);">${o.created_at ? o.created_at.split(' ')[0] : ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

function downloadIosProfile(clientId, dnsUrl) {
    const cleanHost = dnsUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>https://${cleanHost}/dns-query</string>
            </dict>
            <key>PayloadDescription</key>
            <string>Configures Encrypted DNS-over-HTTPS for ${cleanHost}</string>
            <key>PayloadDisplayName</key>
            <string>Private DNS (${clientId})</string>
            <key>PayloadIdentifier</key>
            <string>com.dns.profile.${clientId}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${crypto.randomUUID()}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Private DNS Access (${clientId})</string>
    <key>PayloadIdentifier</key>
    <string>com.dns.profile.${clientId}.main</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${crypto.randomUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    const blob = new Blob([mobileconfig], { type: "application/x-apple-aspen-config" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientId}-dns.mobileconfig`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// Order Modal Handling & Submission
// ----------------------------------------------------
function openOrderModal(planId) {
    if (!siteConfig || !siteConfig.plans) return;
    currentPlan = siteConfig.plans.find(p => p.id === planId) || siteConfig.plans[0];

    document.getElementById("order-plan-id").value = currentPlan.id;
    document.getElementById("modal-plan-title").textContent = `Order ${currentPlan.name}`;
    document.getElementById("modal-plan-price").textContent = `${currentPlan.price} ${siteConfig.currency_symbol || 'SAR'}`;

    // Auto-fill if user logged in
    if (customerUser) {
        document.getElementById("order-name").value = customerUser.name || "";
        document.getElementById("order-phone").value = customerUser.phone || "";
        document.getElementById("order-email").value = customerUser.email || "";
    }

    document.getElementById("order-modal").classList.add("active");
}

function closeOrderModal() {
    document.getElementById("order-modal").classList.remove("active");
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("order-submit-btn");
    btn.disabled = true;
    btn.textContent = "Processing Order...";

    const payload = {
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        duration_days: currentPlan.duration_days,
        amount: currentPlan.price,
        currency: siteConfig.currency || "SAR",
        customer_name: document.getElementById("order-name").value.trim(),
        customer_phone: document.getElementById("order-phone").value.trim(),
        customer_email: document.getElementById("order-email").value.trim(),
        payment_method: document.getElementById("order-payment-method").value,
        trx_id: document.getElementById("order-trx").value.trim()
    };

    const headers = { "Content-Type": "application/json" };
    if (customerToken) {
        headers["Authorization"] = `Bearer ${customerToken}`;
    }

    try {
        const res = await fetch("/api/order", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(`🎉 ${data.message}\n\nOrder ID: ${data.data.order_id}\nAmount: ${data.data.amount} ${data.data.currency}`);
            closeOrderModal();
            document.getElementById("order-form").reset();

            if (customerToken) {
                fetchCustomerData();
                openUserModal();
            }
        } else {
            alert("❌ " + (data.error || "Failed to submit order"));
        }
    } catch (err) {
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm & Submit Order";
    }
}

// ----------------------------------------------------
// Public Status Checker (PIN / Phone)
// ----------------------------------------------------
async function checkDnsStatus() {
    const query = document.getElementById("checker-query").value.trim();
    const resBox = document.getElementById("checker-result");

    if (!query) {
        alert("Please enter your Phone Number or DNS PIN");
        return;
    }

    resBox.style.display = "block";
    resBox.innerHTML = `<div style="text-align: center; color: var(--text-muted);">Checking database...</div>`;

    try {
        const res = await fetch(`/api/check-status?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.success && data.found) {
            const d = data.data;
            resBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 8px;">✓ Active Subscription Found!</div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                    <div>Customer: <b style="color:#fff;">${d.customer_name}</b></div>
                    <div>Plan: <b>${d.plan_name}</b></div>
                    <div>Status: <span class="badge badge-approved">${d.status}</span></div>
                    ${d.dns_url ? `<div style="margin-top:8px;">DNS Hostname: <code style="color:#38bdf8; font-weight:bold;">${d.dns_url}</code></div>` : ''}
                    ${d.expire_date ? `<div>Expires: <b>${d.expire_date.split('T')[0]}</b></div>` : ''}
                </div>
            `;
        } else {
            resBox.innerHTML = `
                <div style="color: #f87171; font-weight: 700;">No active subscription found for "${query}".</div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">If you just submitted payment, please allow a few minutes for verification.</div>
            `;
        }
    } catch (e) {
        resBox.innerHTML = `<div style="color: #f87171;">Check error: ${e.message}</div>`;
    }
}
