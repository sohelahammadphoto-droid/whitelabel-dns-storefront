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
            if (data.reseller && data.reseller.credits !== undefined) {
                document.getElementById("reseller-balance").textContent = `${data.reseller.credits} Credits`;
            }
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
            if (data.reseller && data.reseller.credits !== undefined) {
                document.getElementById("reseller-balance").textContent = `${data.reseller.credits} Credits`;
            }
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
    loadSettings();
}

function showTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
    document.querySelectorAll(".admin-nav-item").forEach(el => el.classList.remove("active"));
    
    document.getElementById(`tab-${tabName}`).style.display = "block";
    const titles = { orders: "Orders & Sales", generate: "Manual PIN Gen", settings: "Store Settings" };
    document.getElementById("page-title").textContent = titles[tabName] || "Dashboard";
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

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><b style="color:#fff;">${o.order_id}</b><br><span style="font-size:11px; color:var(--text-muted);">${o.created_at || ''}</span></td>
                <td><b>${o.customer_name}</b><br><span style="color:#38bdf8; font-size:12px;">${o.customer_phone}</span></td>
                <td>${o.plan_name}<br><b style="color:#fff;">${o.amount} ${o.currency}</b></td>
                <td><b>${o.payment_method}</b><br><code style="color:#a78bfa; font-size:11px;">${o.trx_id}</code></td>
                <td><span class="badge badge-${o.status}">${o.status}</span></td>
                <td>${o.client_id ? `<code style="color:#34d399; font-weight:800;">${o.client_id}</code>` : '<span style="color:var(--text-muted);">--</span>'}</td>
                <td>
                    ${o.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="approveOrder('${o.order_id}')">✓ Approve & Gen DNS</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectOrder('${o.order_id}')">✕ Reject</button>
                    ` : o.dns_url ? `
                        <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${o.dns_url}').then(() => alert('Copied: ${o.dns_url}'))">Copy Hostname</button>
                    ` : '<span style="color:var(--text-muted);">Done</span>'}
                </td>
            </tr>
        `).join('');
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

async function handleManualGenerate(e) {
    e.preventDefault();
    const btn = document.getElementById("gen-submit-btn");
    btn.disabled = true;
    btn.textContent = "Generating...";

    const payload = {
        username: document.getElementById("gen-username").value.trim(),
        phone: document.getElementById("gen-phone").value.trim(),
        duration_days: parseInt(document.getElementById("gen-duration").value, 10)
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
            resBox.innerHTML = `
                <div style="color: #34d399; font-weight: 800; font-size: 16px; margin-bottom: 8px;">🎉 DNS PIN Created Successfully!</div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                    <div>PIN / Client ID: <b style="color:#fff;">${d.client_id}</b></div>
                    <div>DNS Hostname: <b style="color:#38bdf8;">${d.dns_url}</b></div>
                    <div>Expires At: <b>${d.expire_date}</b></div>
                </div>
                <button class="btn btn-primary btn-sm" style="margin-top: 10px;" onclick="navigator.clipboard.writeText('${d.dns_url}').then(() => alert('Copied!'))">Copy Hostname</button>
            `;
            loadOrders();
        } else {
            resBox.innerHTML = `<div style="color: #f87171; font-weight:700;">❌ ${data.error || "Generation failed"}</div>`;
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate DNS PIN";
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
        }
    } catch (_) {}
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
        reseller_api_key: document.getElementById("setting-apikey").value.trim(),
        main_api_url: document.getElementById("setting-apiurl").value.trim(),
        site_name: document.getElementById("setting-sitename").value.trim(),
        tagline: document.getElementById("setting-tagline").value.trim(),
        support_whatsapp: document.getElementById("setting-whatsapp").value.trim(),
        notice: document.getElementById("setting-notice").value.trim()
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
            alert("✅ Settings saved successfully to your D1 Database!");
            loadSettings();
        } else {
            alert("❌ Failed to save: " + data.error);
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
