// TransitOps - Main SPA Coordinator & Full-Stack Application Controller
// Date Reference Context: July 12, 2026

document.addEventListener("DOMContentLoaded", () => {
  // Check if session token exists, if not lock screen
  const db = window.db;
  const current = db.getCurrentUser();
  if (current) {
    document.getElementById("modal-login").style.display = "none";
    updateHeaderUserBadge(current);
    const userNav = document.getElementById("nav-item-users");
    if (userNav) {
      userNav.style.display = current.role === "Admin" ? "block" : "none";
    }
  } else {
    document.getElementById("modal-login").style.display = "flex";
  }

  // Initialize UI controls
  initNavigation();
  initThemeToggle();
  initFormListeners();
  initLoginFlow();

  // Populate data on start
  renderActiveView();

  // Initialize Lucide Icons
  lucide.createIcons();
});

// ----------------------------------------------------
// NAVIGATION & SPA ROUTING
// ----------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-links .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      // If not logged in, block navigation
      const db = window.db;
      if (!db.getCurrentUser()) {
        window.showToast("Please authenticate first to access modules.", "warning");
        return;
      }

      const targetView = item.getAttribute("data-view");

      // Switch active class in sidebar
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");

      // Hide all panels
      document.querySelectorAll(".view-panel").forEach(panel => {
        panel.style.display = "none";
      });

      // Show target panel
      const targetPanel = document.getElementById(`panel-${targetView}`);
      if (targetPanel) {
        targetPanel.style.display = "block";
      }

      // Update header title
      const titleElement = document.getElementById("view-title");
      const titleMap = {
        dashboard: "Dashboard Overview",
        vehicles: "Vehicles Registry",
        drivers: "Drivers Hub",
        trips: "Trips & Dispatch Management",
        tracking: "GPS Live Tracking Simulation",
        maintenance: "Maintenance Schedules",
        expenses: "Expenses & Fleet ROI",
        verification: "Driver Identity Verification",
        logs: "System Audit Logs & Future Architecture",
        users: "User Management & Operator Roles"
      };
      titleElement.textContent = titleMap[targetView] || "TransitOps Platform";

      // If switching to tracking panel, initialize Leaflet Map
      if (targetView === "tracking") {
        setTimeout(() => {
          window.initTrackingMap();
        }, 100);
      }

      // Re-render dashboard charts if switching to dashboard/expenses
      if (targetView === "dashboard" || targetView === "expenses") {
        setTimeout(async () => {
          if (window.initCharts) window.initCharts();
          // Keep chart colors synchronized with current theme mode
          const isDark = document.documentElement.getAttribute("data-theme") === "dark";
          if (window.updateChartsTheme) window.updateChartsTheme(isDark);
        }, 150);
      }

      renderActiveView();
      lucide.createIcons();
    });
  });
}

// ----------------------------------------------------
// SYSTEM STATE RENDERING (ASYNC INTEGRATION)
// ----------------------------------------------------
async function renderActiveView() {
  const activeNavItem = document.querySelector(".nav-links .nav-item.active");
  if (!activeNavItem) return;

  const currentView = activeNavItem.getAttribute("data-view");
  const db = window.db;
  if (!db || !db.getCurrentUser()) return;

  // Enforce Role Restrictions visual state
  enforceRbacAccess();

  switch (currentView) {
    case "dashboard":
      await renderDashboardKPIs();
      await renderComplianceReminders();
      break;
    case "vehicles":
      await renderVehiclesTable();
      break;
    case "drivers":
      await renderDriversHub();
      break;
    case "trips":
      await renderTripsLedger();
      break;
    case "tracking":
      if (window.updateMapTrips) window.updateMapTrips();
      await renderLiveTrackingFeed();
      break;
    case "maintenance":
      await renderMaintenanceTables();
      break;
    case "expenses":
      await renderExpensesLedger();
      break;
    case "verification":
      await renderVerificationDriversDropdown();
      break;
    case "logs":
      await renderAuditLogsTable();
      break;
    case "users":
      await renderUsersTable();
      break;
  }
}

// ----------------------------------------------------
// CREDENTIALS AUTHENTICATION FLOW
// ----------------------------------------------------
function initLoginFlow() {
  const db = window.db;
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email-input");
  const passwordInput = document.getElementById("login-password-input");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      window.showToast("Email and password are required.", "danger");
      return;
    }

    try {
      const data = await db.login(email, password);
      if (data.status === "success") {
        db.setCurrentUser(data.user);
        updateHeaderUserBadge(data.user);
        
        // Hide login modal
        document.getElementById("modal-login").style.display = "none";
        window.showToast(`Welcome back, ${data.user.name}! Access Authorized.`, "success");
        
        // Setup User Management navigation visibility
        const userNav = document.getElementById("nav-item-users");
        if (userNav) {
          userNav.style.display = data.user.role === "Admin" ? "block" : "none";
        }

        // Reload UI
        renderActiveView();
      } else {
        window.showToast("Authentication failed.", "danger");
      }
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // Logout button trigger
  document.getElementById("btn-sign-out")?.addEventListener("click", () => {
    db.setCurrentUser(null);
    updateHeaderUserBadge(null);

    // Hide user management nav item
    const userNav = document.getElementById("nav-item-users");
    if (userNav) userNav.style.display = "none";

    // Show login modal and reset inputs
    document.getElementById("modal-login").style.display = "flex";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    
    window.showToast("Logged out successfully. Identity locked.", "info");
  });
}

function updateHeaderUserBadge(user) {
  const badge = document.getElementById("header-user-badge");
  const avatar = document.getElementById("sidebar-avatar");
  const sidebarName = document.getElementById("sidebar-user-name");
  const sidebarRole = document.getElementById("sidebar-user-role");

  if (!badge) return;

  if (user) {
    badge.textContent = `${user.name} (${user.role})`;
    if (sidebarName) sidebarName.textContent = user.name;
    if (sidebarRole) sidebarRole.textContent = user.role;

    if (avatar) {
      const avatars = {
        "Admin": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
        "Fleet Manager": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop",
        "Dispatch Manager": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop",
        "Driver": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
        "Safety Officer": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop",
        "Financial Analyst": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop"
      };
      avatar.src = avatars[user.role] || avatars["Admin"];
    }
  } else {
    badge.textContent = "Locked";
    if (sidebarName) sidebarName.textContent = "Locked";
    if (sidebarRole) sidebarRole.textContent = "No session";
    if (avatar) avatar.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop";
  }
}

// ----------------------------------------------------
// DASHBOARD VIEW
// ----------------------------------------------------
async function renderDashboardKPIs() {
  const db = window.db;
  let vehicles = await db.getVehicles();
  let drivers = await db.getDrivers();
  let trips = await db.getTrips();

  // Read filter values
  const typeFilter = document.getElementById("dashboard-filter-type")?.value || "All";
  const statusFilter = document.getElementById("dashboard-filter-status")?.value || "All";
  const regionFilter = document.getElementById("dashboard-filter-region")?.value || "All";

  // Filter vehicles
  if (typeFilter !== "All") {
    vehicles = vehicles.filter(v => v.type === typeFilter);
  }
  if (statusFilter !== "All") {
    vehicles = vehicles.filter(v => v.status === statusFilter);
  }
  if (regionFilter !== "All") {
    vehicles = vehicles.filter(v => v.region === regionFilter);
  }

  // Filter trips & drivers based on matching vehicle list if region/type filters are active
  const vehicleIds = vehicles.map(v => v.id);
  
  const activeTripsCount = trips.filter(t => t.status === "Dispatched" && vehicleIds.includes(t.vehicleId)).length;
  const pendingTripsCount = trips.filter(t => t.status === "Draft" && vehicleIds.includes(t.vehicleId)).length;

  const totalActiveVehiclesCount = vehicles.filter(v => v.status !== "Retired").length;
  const onTripVehiclesCount = vehicles.filter(v => v.status === "On Trip").length;
  const availableVehiclesCount = vehicles.filter(v => v.status === "Available").length;
  const inShopVehiclesCount = vehicles.filter(v => v.status === "In Shop").length;

  // Filter drivers on duty and available
  let filteredDrivers = drivers;
  if (regionFilter !== "All") {
    // Check drivers driving vehicles from this region
    const regionalVehicles = vehicles.filter(v => v.region === regionFilter).map(v => v.id);
    filteredDrivers = drivers.filter(d => {
      if (d.status === "On Trip") {
        const activeTrip = trips.find(t => t.driverId === d.id && t.status === "Dispatched");
        return activeTrip && regionalVehicles.includes(activeTrip.vehicleId);
      }
      return true;
    });
  }
  const driversOnDuty = filteredDrivers.filter(d => d.status === "On Trip").length;

  const utilization = totalActiveVehiclesCount > 0 
    ? ((onTripVehiclesCount / totalActiveVehiclesCount) * 100).toFixed(1) 
    : 0;

  // Update UI Elements safely
  const elActiveVehicles = document.getElementById("kpi-active-vehicles");
  const elAvailableVehicles = document.getElementById("kpi-available-vehicles");
  const elInShop = document.getElementById("kpi-in-shop");
  const elActiveTrips = document.getElementById("kpi-active-trips");
  const elPendingTrips = document.getElementById("kpi-pending-trips");
  const elDriversOnDuty = document.getElementById("kpi-drivers-on-duty");
  const elUtilization = document.getElementById("kpi-utilization");

  if (elActiveVehicles) elActiveVehicles.textContent = onTripVehiclesCount;
  if (elAvailableVehicles) elAvailableVehicles.textContent = availableVehiclesCount;
  if (elInShop) elInShop.textContent = inShopVehiclesCount;
  if (elActiveTrips) elActiveTrips.textContent = activeTripsCount;
  if (elPendingTrips) elPendingTrips.textContent = pendingTripsCount;
  if (elDriversOnDuty) elDriversOnDuty.textContent = driversOnDuty;
  if (elUtilization) elUtilization.textContent = `${utilization}%`;
}

async function renderComplianceReminders() {
  const db = window.db;
  const vehicles = await db.getVehicles();
  const drivers = await db.getDrivers();
  const maintenance = await db.getMaintenance();
  const container = document.getElementById("dashboard-reminders-list");
  
  if (!container) return;
  container.innerHTML = "";

  const alerts = [];
  const refDate = window.CURRENT_DATE; // July 12, 2026

  vehicles.forEach(v => {
    if (v.status === "Retired") return;

    const insDate = new Date(v.insuranceExpiry);
    const fitDate = new Date(v.fitnessExpiry);
    const permitDate = v.permitExpiry ? new Date(v.permitExpiry) : null;

    if (insDate < refDate) {
      alerts.push({
        type: "danger",
        title: `Insurance Expired: ${v.registrationNumber}`,
        desc: `Expired on ${v.insuranceExpiry}. Dispatch blocked.`,
        actionText: "Renew",
        actionFn: `triggerDocRenewal('${v.id}', 'insurance')`
      });
    } else if ((insDate - refDate) / (1000 * 60 * 60 * 24) < 30) {
      alerts.push({
        type: "warning",
        title: `Insurance Expiring Soon: ${v.registrationNumber}`,
        desc: `Expires on ${v.insuranceExpiry} (Less than 30 days left).`,
        actionText: "Renew",
        actionFn: `triggerDocRenewal('${v.id}', 'insurance')`
      });
    }

    if (fitDate < refDate) {
      alerts.push({
        type: "danger",
        title: `Fitness Certificate Expired: ${v.registrationNumber}`,
        desc: `Expired on ${v.fitnessExpiry}. safety check required.`,
        actionText: "Renew",
        actionFn: `triggerDocRenewal('${v.id}', 'fitness')`
      });
    }

    if (permitDate && permitDate < refDate) {
      alerts.push({
        type: "danger",
        title: `State Permit Expired: ${v.registrationNumber}`,
        desc: `Expired on ${v.permitExpiry}. Operations halted.`,
        actionText: "Renew",
        actionFn: `triggerDocRenewal('${v.id}', 'permit')`
      });
    }
  });

  drivers.forEach(d => {
    if (d.availabilityStatus === "Suspended") return;

    const licExp = new Date(d.licenseExpiry);
    if (licExp < refDate) {
      alerts.push({
        type: "danger",
        title: `Driver License Expired: ${d.name}`,
        desc: `License ${d.licenseNumber} expired on ${d.licenseExpiry}. Dispatch suspended.`,
        actionText: "Renew",
        actionFn: `triggerDriverLicenseRenewal('${d.id}')`
      });
    } else if ((licExp - refDate) / (1000 * 60 * 60 * 24) < 30) {
      alerts.push({
        type: "warning",
        title: `License Expiring Soon: ${d.name}`,
        desc: `Expires on ${d.licenseExpiry}. Renew immediately.`,
        actionText: "Renew",
        actionFn: `triggerDriverLicenseRenewal('${d.id}')`
      });
    }

    if (d.verificationStatus === "Pending") {
      alerts.push({
        type: "warning",
        title: `Verification Pending: ${d.name}`,
        desc: `Identity documents (Aadhaar/License) need verification approval.`,
        actionText: "Verify Profile",
        actionFn: `triggerDriverVerificationAction('${d.id}', 'Verified')`
      });
    } else if (d.verificationStatus === "Failed") {
      alerts.push({
        type: "danger",
        title: `Verification Failed: ${d.name}`,
        desc: `Profile check rejected due to validation errors.`,
        actionText: "Review File",
        actionFn: `triggerDriverVerificationAction('${d.id}', 'Pending')`
      });
    }
  });

  maintenance.forEach(m => {
    if (m.status === "Active") {
      const scheduled = new Date(m.scheduledDate);
      if (scheduled <= refDate) {
        const v = vehicles.find(veh => veh.id === m.vehicleId);
        alerts.push({
          type: "warning",
          title: `Overdue Maintenance: ${v ? v.registrationNumber : 'Unknown'}`,
          desc: `Servicing "${m.description}" was scheduled for ${m.scheduledDate}.`,
          actionText: "Complete Job",
          actionFn: `triggerMaintDone('${m.id}')`
        });
      }
    }
  });

  document.getElementById("reminder-count").textContent = `${alerts.length} Compliance Alerts`;
  if (alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:13px;">
        <i data-lucide="check-circle-2" style="color:var(--success); width:32px; height:32px; margin-bottom:10px; display:inline-block;"></i><br>
        All fleet documents, vehicle fitness certificates, and driver licenses are fully compliant.
      </div>
    `;
    lucide.createIcons();
    return;
  }

  alerts.forEach(alert => {
    const card = document.createElement("div");
    card.className = `alert-item ${alert.type}`;
    card.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <i data-lucide="${alert.type === 'danger' ? 'alert-octagon' : 'alert-triangle'}" style="margin-top: 2px; flex-shrink: 0;"></i>
        <div>
          <div class="alert-title">${alert.title}</div>
          <div class="alert-desc">${alert.desc}</div>
        </div>
      </div>
      <button class="alert-action-btn" onclick="${alert.actionFn}">${alert.actionText}</button>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

window.triggerDocRenewal = async function(vehicleId, docType) {
  const db = window.db;
  const v = await db.getVehicleById(vehicleId);
  if (!v) return;

  const nextYear = new Date(window.CURRENT_DATE);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  v[`${docType}Expiry`] = nextYear.toISOString().split("T")[0];

  try {
    await db.saveVehicle(v);
    window.showToast(`Updated ${docType} certificate for ${v.registrationNumber}`, "success");
    await renderActiveView();
  } catch (err) {
    window.showToast(err.message, "danger");
  }
};

window.triggerDriverLicenseRenewal = async function(driverId) {
  const db = window.db;
  const d = await db.getDriverById(driverId);
  if (!d) return;

  const nextYear = new Date(window.CURRENT_DATE);
  nextYear.setFullYear(nextYear.getFullYear() + 2);
  d.licenseExpiry = nextYear.toISOString().split("T")[0];

  try {
    await db.saveDriver(d);
    window.showToast(`Driving license extended for ${d.name} to ${d.licenseExpiry}`, "success");
    await renderActiveView();
  } catch (err) {
    window.showToast(err.message, "danger");
  }
};

window.triggerDriverVerificationAction = async function(driverId, newStatus) {
  const db = window.db;
  const d = await db.getDriverById(driverId);
  if (!d) return;

  d.verificationStatus = newStatus;
  try {
    await db.saveDriver(d);
    window.showToast(`Verification status of ${d.name} updated to ${newStatus}`, "success");
    await renderActiveView();
  } catch (err) {
    window.showToast(err.message, "danger");
  }
};

// ----------------------------------------------------
// VEHICLES VIEW
// ----------------------------------------------------
async function renderVehiclesTable() {
  const db = window.db;
  const body = document.getElementById("vehicle-table-body");
  if (!body) return;
  body.innerHTML = "";

  const searchVal = document.getElementById("vehicle-search").value.toLowerCase();
  const filterStatus = document.getElementById("vehicle-filter-status").value;

  const vehicles = await db.getVehicles();

  vehicles.forEach(v => {
    const matchesSearch = v.registrationNumber.toLowerCase().includes(searchVal) || v.model.toLowerCase().includes(searchVal);
    const matchesStatus = filterStatus === "All" || v.status === filterStatus;

    if (!matchesSearch || !matchesStatus) return;

    const refDate = window.CURRENT_DATE;
    const hasExpiredDocs = new Date(v.insuranceExpiry) < refDate || new Date(v.fitnessExpiry) < refDate || (v.permitExpiry && new Date(v.permitExpiry) < refDate);

    const complianceBadge = hasExpiredDocs
      ? '<span style="color:var(--danger); display:flex; align-items:center; gap:4px; font-weight:bold;"><i data-lucide="alert-circle" style="width:14px; height:14px;"></i> Expired Docs</span>'
      : '<span style="color:var(--success); display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Valid Certificates</span>';

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><b>${v.registrationNumber}</b></td>
      <td>${v.model}</td>
      <td><span class="badge" style="background-color:rgba(59, 130, 246, 0.1); color:var(--primary); font-weight:bold;">${v.type}</span></td>
      <td>${v.maxLoad.toLocaleString()} kg</td>
      <td>${v.odometer.toLocaleString()} km</td>
      <td><span class="badge badge-${v.status.toLowerCase().replace(" ", "")}">${v.status}</span></td>
      <td>${complianceBadge}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="viewVehicleDetails('${v.id}')"><i data-lucide="eye" style="width:12px; height:12px;"></i> View</button>
          <button class="btn-secondary edit-vehicle-btn" style="padding:4px 8px; font-size:11px;" onclick="editVehicle('${v.id}')"><i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edit</button>
        </div>
      </td>
    `;
    body.appendChild(row);
  });
  lucide.createIcons();
}

window.viewVehicleDetails = async function(vehicleId) {
  const db = window.db;
  const v = await db.getVehicleById(vehicleId);
  if (!v) return;

  const expenses = (await db.getExpenses()).filter(e => e.vehicleId === v.id);
  const maintenance = (await db.getMaintenance()).filter(m => m.vehicleId === v.id);
  const totalExp = expenses.filter(e => e.type !== "Income").reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalInc = expenses.filter(e => e.type === "Income").reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const bodyEl = document.getElementById("details-modal-body");
  document.getElementById("details-modal-title").textContent = `Vehicle Profile: ${v.registrationNumber}`;

  bodyEl.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr; gap:16px; font-family:var(--font-body); font-size:13px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:var(--bg-tertiary); padding:16px; border-radius:10px;">
        <div><b>Model:</b> ${v.model}</div>
        <div><b>Type:</b> ${v.type}</div>
        <div><b>Max Carrying Capacity:</b> ${v.maxLoad.toLocaleString()} kg</div>
        <div><b>Odometer:</b> ${v.odometer.toLocaleString()} km</div>
        <div><b>Acquisition Cost:</b> ${v.acquisitionCost.toLocaleString()} INR</div>
        <div><b>Current Status:</b> <span class="badge badge-${v.status.toLowerCase().replace(" ", "")}">${v.status}</span></div>
        <div style="grid-column: span 2;"><b>Specs:</b> ${v.specifications || 'None'}</div>
      </div>

      <div>
        <h4 style="margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i data-lucide="shield-check"></i> Compliance Checklist</h4>
        <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:6px;">
          <li style="display:flex; justify-content:space-between; padding:6px 12px; background:var(--bg-tertiary); border-radius:6px;">
            <span>Insurance Expiry:</span>
            <b style="color:${new Date(v.insuranceExpiry) < window.CURRENT_DATE ? 'var(--danger)' : 'var(--success)'}">${v.insuranceExpiry}</b>
          </li>
          <li style="display:flex; justify-content:space-between; padding:6px 12px; background:var(--bg-tertiary); border-radius:6px;">
            <span>Fitness Certificate Expiry:</span>
            <b style="color:${new Date(v.fitnessExpiry) < window.CURRENT_DATE ? 'var(--danger)' : 'var(--success)'}">${v.fitnessExpiry}</b>
          </li>
          <li style="display:flex; justify-content:space-between; padding:6px 12px; background:var(--bg-tertiary); border-radius:6px;">
            <span>State Operations Permit Expiry:</span>
            <b style="color:${v.permitExpiry && new Date(v.permitExpiry) < window.CURRENT_DATE ? 'var(--danger)' : 'var(--success)'}">${v.permitExpiry || 'N/A'}</b>
          </li>
        </ul>
      </div>

      <div class="details-tab-bar">
        <span class="details-tab active" onclick="switchDetailTab('maint')">Maintenance History (${maintenance.length})</span>
        <span class="details-tab" onclick="switchDetailTab('finance')">Financial Yield Ledger</span>
      </div>

      <div id="tab-content-maint">
        ${maintenance.length === 0 
          ? '<p style="color:var(--text-muted);">No recorded maintenance logs.</p>'
          : `<table class="custom-table" style="font-size:11px;">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Cost (INR)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${maintenance.map(m => `
                  <tr>
                    <td><b>${m.type}</b></td>
                    <td>${m.description}</td>
                    <td>${m.scheduledDate}</td>
                    <td>${m.cost.toLocaleString()}</td>
                    <td><span class="badge badge-${m.status.toLowerCase()}">${m.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>

      <div id="tab-content-finance" style="display:none;">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center; margin-bottom:12px;">
          <div style="background:rgba(16, 185, 129, 0.08); padding:10px; border-radius:8px;">
            <div style="font-size:10px; color:var(--text-secondary);">EARNINGS</div>
            <b style="color:var(--success); font-size:14px;">${totalInc.toLocaleString()} INR</b>
          </div>
          <div style="background:rgba(239, 68, 68, 0.08); padding:10px; border-radius:8px;">
            <div style="font-size:10px; color:var(--text-secondary);">EXPENSES</div>
            <b style="color:var(--danger); font-size:14px;">${totalExp.toLocaleString()} INR</b>
          </div>
          <div style="background:var(--bg-tertiary); padding:10px; border-radius:8px;">
            <div style="font-size:10px; color:var(--text-secondary);">NET OPERATIONS</div>
            <b style="color:${(totalInc - totalExp) >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size:14px;">${(totalInc - totalExp).toLocaleString()} INR</b>
          </div>
        </div>

        ${expenses.length === 0
          ? '<p style="color:var(--text-muted);">No recorded expenses.</p>'
          : `<table class="custom-table" style="font-size:11px;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map(e => `
                  <tr>
                    <td>${e.date}</td>
                    <td><span style="font-weight:bold; color:${e.type === 'Income' ? 'var(--success)' : 'inherit'}">${e.type}</span></td>
                    <td>${e.description}</td>
                    <td>${e.type === 'Income' ? '+' : '-'}${e.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
             </table>`
        }
      </div>
    </div>
  `;

  openModal("modal-details");
  lucide.createIcons();
};

window.editVehicle = async function(vehicleId) {
  const db = window.db;
  const v = await db.getVehicleById(vehicleId);
  if (!v) return;

  document.getElementById("vehicle-id").value = v.id;
  document.getElementById("vehicle-reg").value = v.registrationNumber;
  document.getElementById("vehicle-model").value = v.model;
  document.getElementById("vehicle-type").value = v.type;
  document.getElementById("vehicle-load").value = v.maxLoad;
  document.getElementById("vehicle-odometer").value = v.odometer;
  document.getElementById("vehicle-cost").value = v.acquisitionCost;
  document.getElementById("vehicle-insurance").value = v.insuranceExpiry;
  document.getElementById("vehicle-fitness").value = v.fitnessExpiry;
  document.getElementById("vehicle-permit").value = v.permitExpiry;
  document.getElementById("vehicle-region").value = v.region || "Pune";
  document.getElementById("vehicle-specs").value = v.specifications || "";

  document.getElementById("vehicle-modal-title").textContent = "Modify Vehicle Details";
  openModal("modal-vehicle");
};

// ----------------------------------------------------
// DRIVERS HUB VIEW
// ----------------------------------------------------
// DRIVERS HUB VIEW
// ----------------------------------------------------
async function renderDriversHub() {
  const db = window.db;
  const container = document.getElementById("driver-cards-container");
  if (!container) return;
  container.innerHTML = "";

  const searchVal = document.getElementById("driver-search").value.toLowerCase();
  const filterStatus = document.getElementById("driver-filter-status").value;
  const filterVerify = document.getElementById("driver-filter-verify").value;

  const drivers = await db.getDrivers();

  drivers.forEach(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchVal) || d.licenseNumber.toLowerCase().includes(searchVal);
    const matchesStatus = filterStatus === "All" || d.status === filterStatus;
    const matchesVerify = filterVerify === "All" || d.verificationStatus === filterVerify;

    if (!matchesSearch || !matchesStatus || !matchesVerify) return;

    const licenseExpired = new Date(d.licenseExpiry) < window.CURRENT_DATE;
    const licenseBadge = licenseExpired 
      ? '<span class="badge badge-failed">LICENSE EXPIRED</span>'
      : `<span style="font-size:11px; color:var(--text-secondary);">Expiry: ${d.licenseExpiry}</span>`;

    const card = document.createElement("div");
    card.className = "driver-profile-card";
    card.innerHTML = `
      <div class="profile-card-header">
        <img src="${d.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'}" alt="${d.name}" class="profile-card-img">
        <div class="profile-card-title">
          <h3>${d.name}</h3>
          <span class="badge badge-${d.verificationStatus.toLowerCase()}">${d.verificationStatus} Badge</span>
        </div>
      </div>
      <div class="profile-card-body">
        <div class="profile-meta-row">
          <span class="profile-meta-label">License Number:</span>
          <span class="profile-meta-val">${d.licenseNumber}</span>
        </div>
        <div class="profile-meta-row">
          <span class="profile-meta-label">Contact Number:</span>
          <span class="profile-meta-val">${d.contactNumber || 'N/A'}</span>
        </div>
        <div class="profile-meta-row">
          <span class="profile-meta-label">License Class:</span>
          <span class="profile-meta-val">${d.licenseCategory}</span>
        </div>
        <div class="profile-meta-row">
          <span class="profile-meta-label">Experience:</span>
          <span class="profile-meta-val">${d.experience} Years</span>
        </div>
        <div class="profile-meta-row">
          <span class="profile-meta-label">Safety Rating:</span>
          <span class="profile-meta-val" style="color:${d.safetyScore >= 85 ? 'var(--success)' : 'var(--warning)'}">${d.safetyScore}/100</span>
        </div>
        <div class="profile-meta-row" style="margin-top: 6px;">
          <span class="profile-meta-label">Duty Status:</span>
          <span class="badge badge-${d.status.toLowerCase().replace(" ", "")}">${d.status}</span>
        </div>
        <div style="margin-top:4px;">
          ${licenseBadge}
        </div>
      </div>
      <div class="profile-card-actions driver-edit-actions">
        <button class="btn-secondary" style="flex-grow:1; font-size:11px;" onclick="viewDriverDetails('${d.id}')"><i data-lucide="eye" style="width:12px; height:12px;"></i> Profile</button>
        <button class="btn-secondary edit-driver-btn" style="flex-grow:1; font-size:11px;" onclick="editDriver('${d.id}')"><i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edit</button>
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

window.viewDriverDetails = async function(driverId) {
  const db = window.db;
  const d = await db.getDriverById(driverId);
  if (!d) return;

  const bodyEl = document.getElementById("details-modal-body");
  document.getElementById("details-modal-title").textContent = `Driver Profile: ${d.name}`;

  const isLicenseExpired = new Date(d.licenseExpiry) < window.CURRENT_DATE;

  bodyEl.innerHTML = `
    <div style="display:grid; grid-template-columns:150px 1fr; gap:20px; font-family:var(--font-body); font-size:13px;">
      <div style="text-align:center;">
        <img src="${d.photo}" alt="${d.name}" style="width:135px; height:135px; border-radius:10px; object-fit:cover; border:3px solid var(--primary); margin-bottom:10px;">
        <span class="badge badge-${d.verificationStatus.toLowerCase()}" style="width:100%; display:block; text-align:center;">Status: ${d.verificationStatus}</span>
      </div>
      <div>
        <div style="background:var(--bg-tertiary); padding:16px; border-radius:10px; display:flex; flex-direction:column; gap:8px;">
          <div><b>Identity Check:</b> ${d.governmentId}</div>
          <div><b>Contact Number:</b> ${d.contactNumber || 'N/A'}</div>
          <div><b>Emergency Contact:</b> ${d.emergencyContact}</div>
          <div><b>License Category:</b> ${d.licenseCategory}</div>
          <div><b>License Number:</b> ${d.licenseNumber}</div>
          <div><b>License Expiry:</b> <span style="font-weight:bold; color:${isLicenseExpired ? 'var(--danger)' : 'inherit'}">${d.licenseExpiry} ${isLicenseExpired ? '(EXPIRED)' : ''}</span></div>
          <div><b>Safety Score:</b> <b style="font-size:14px; color:${d.safetyScore >= 85 ? 'var(--success)' : 'var(--warning)'}">${d.safetyScore}/100</b></div>
          <div><b>Duty Availability:</b> <span class="badge badge-${d.status.toLowerCase().replace(" ", "")}">${d.status}</span></div>
        </div>
      </div>
      <div style="grid-column: span 2;">
        <h4 style="margin-bottom:8px;"><i data-lucide="history"></i> Driving Incident Log</h4>
        <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px;">
          ${d.drivingHistory || "Clean record in file. Zero violations."}
        </div>
      </div>
    </div>
  `;

  openModal("modal-details");
  lucide.createIcons();
};

window.editDriver = async function(driverId) {
  const db = window.db;
  const d = await db.getDriverById(driverId);
  if (!d) return;

  document.getElementById("driver-id").value = d.id;
  document.getElementById("driver-name").value = d.name;
  document.getElementById("driver-photo").value = d.photo;
  document.getElementById("driver-license").value = d.licenseNumber;
  document.getElementById("driver-license-cat").value = d.licenseCategory;
  document.getElementById("driver-license-exp").value = d.licenseExpiry;
  document.getElementById("driver-govid").value = d.governmentId;
  document.getElementById("driver-emergency").value = d.emergencyContact;
  document.getElementById("driver-contact").value = d.contactNumber || "";
  document.getElementById("driver-status").value = d.status || "Available";
  document.getElementById("driver-safety").value = d.safetyScore;
  document.getElementById("driver-exp").value = d.experience;
  document.getElementById("driver-verify-status").value = d.verificationStatus;
  document.getElementById("driver-history").value = d.drivingHistory || "";

  document.getElementById("driver-modal-title").textContent = "Modify Driver Profile";
  openModal("modal-driver");
};

// ----------------------------------------------------
// TRIPS & DISPATCH VIEW
// ----------------------------------------------------
async function renderTripsLedger() {
  const db = window.db;
  const draftBody = document.getElementById("draft-trips-body");
  const activeBody = document.getElementById("active-trips-body");
  const historicalBody = document.getElementById("historical-trips-body");
  
  if (!activeBody || !historicalBody || !draftBody) return;

  draftBody.innerHTML = "";
  activeBody.innerHTML = "";
  historicalBody.innerHTML = "";

  const currentUser = db.getCurrentUser();
  let trips = await db.getTrips();
  const vehicles = await db.getVehicles();
  const drivers = await db.getDrivers();

  // Create or retrieve driver trips summary element
  let summaryDiv = document.getElementById("driver-trips-summary");
  if (!summaryDiv) {
    summaryDiv = document.createElement("div");
    summaryDiv.id = "driver-trips-summary";
    summaryDiv.style.marginBottom = "20px";
    summaryDiv.style.padding = "16px";
    summaryDiv.style.background = "var(--bg-tertiary)";
    summaryDiv.style.borderRadius = "10px";
    summaryDiv.style.display = "none";
    const cardEl = document.querySelector("#panel-trips .panel-card");
    if (cardEl) {
      cardEl.insertBefore(summaryDiv, cardEl.children[1]);
    }
  }

  const createBtn = document.getElementById("btn-dispatch-trip");

  if (currentUser && currentUser.role === "Driver") {
    if (createBtn) createBtn.style.display = "none";

    const driverId = currentUser.driverId || "D001";
    trips = trips.filter(t => t.driverId === driverId);

    const completedTrips = trips.filter(t => t.status === "Completed");
    const totalRevenue = completedTrips.reduce((sum, t) => sum + (parseFloat(t.plannedDistance || 0) * 30), 0);

    summaryDiv.style.display = "block";
    summaryDiv.innerHTML = `
      <h4 style="margin-bottom:12px; color:var(--primary); display:flex; align-items:center; gap:6px;">
        <i data-lucide="wallet" style="width:16px; height:16px;"></i> My Shift Earnings & Generated Profits
      </h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px;">
        <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:10px; color:var(--text-secondary); font-weight:bold; letter-spacing:0.05em;">COMPLETED SHIFTS</span>
          <b style="font-size:18px; color:var(--success);">${completedTrips.length}</b>
        </div>
        <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:10px; color:var(--text-secondary); font-weight:bold; letter-spacing:0.05em;">DISTANCE DRIVEN</span>
          <b style="font-size:18px; color:var(--primary);">${completedTrips.reduce((sum, t) => sum + parseFloat(t.plannedDistance || 0), 0).toLocaleString()} km</b>
        </div>
        <div style="background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.2); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:10px; color:var(--text-secondary); font-weight:bold; letter-spacing:0.05em;">MY PROFITS GENERATED</span>
          <b style="font-size:18px; color:#8b5cf6;">${totalRevenue.toLocaleString()} INR</b>
        </div>
      </div>
    `;

    const draftSection = document.querySelector("#panel-trips h4");
    const draftTable = document.querySelector("#panel-trips .table-wrapper");
    const assignedDrafts = trips.filter(t => t.status === "Draft");
    if (assignedDrafts.length === 0) {
      if (draftSection) draftSection.style.display = "none";
      if (draftTable) draftTable.style.display = "none";
    } else {
      if (draftSection) draftSection.style.display = "flex";
      if (draftTable) draftTable.style.display = "block";
    }
  } else {
    if (createBtn) createBtn.style.display = "inline-flex";
    summaryDiv.style.display = "none";

    const draftSection = document.querySelector("#panel-trips h4");
    const draftTable = document.querySelector("#panel-trips .table-wrapper");
    if (draftSection) draftSection.style.display = "flex";
    if (draftTable) draftTable.style.display = "block";
  }

  trips.forEach(trip => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    const driver = drivers.find(d => d.id === trip.driverId);
    if (!vehicle || !driver) return;

    if (trip.status === "Draft") {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><b>${trip.id}</b></td>
        <td>${trip.source} &rarr; <br>${trip.destination}</td>
        <td>${vehicle.registrationNumber}</td>
        <td>${driver.name}</td>
        <td>${trip.cargoWeight.toLocaleString()} kg</td>
        <td>${trip.plannedDistance} km</td>
        <td>${new Date(trip.deliverySchedule).toLocaleString()}</td>
        <td style="text-align:right;">
          <button class="btn-primary" style="padding:4px 8px; font-size:11px; background:var(--success); border-color:var(--success); display:inline-flex; align-items:center; gap:4px;" onclick="triggerDispatchTrip('${trip.id}')"><i data-lucide="send" style="width:12px; height:12px;"></i> Dispatch</button>
        </td>
      `;
      draftBody.appendChild(row);
    } else if (trip.status === "Dispatched" || trip.status === "On Trip") {
      let alertIcons = "";
      if (trip.routeDeviation) {
        alertIcons += '<span class="badge badge-failed" style="padding:2px 6px; font-size:10px; margin-right:4px;">DEVIATING</span>';
      }
      if (trip.speed > 50) {
        alertIcons += `<span class="badge badge-failed" style="padding:2px 6px; font-size:10px;">SPEEDING (${trip.speed} km/h)</span>`;
      }
      if (!alertIcons) {
        alertIcons = '<span class="badge badge-verified" style="padding:2px 6px; font-size:10px;">NORMAL</span>';
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><b>${trip.id}</b></td>
        <td>${trip.source} &rarr; <br>${trip.destination}</td>
        <td>${vehicle.registrationNumber}</td>
        <td>${driver.name}</td>
        <td>${trip.cargoWeight.toLocaleString()} kg</td>
        <td>${trip.plannedDistance} km</td>
        <td><b>${trip.speed} km/h</b></td>
        <td>${alertIcons}</td>
        <td>
          <div style="display:flex; gap:6px;" class="dispatch-action-controls">
            <button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="triggerCompleteTripModal('${trip.id}')"><i data-lucide="check-circle" style="width:12px; height:12px;"></i> Complete</button>
            <button class="btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--danger); border-color:rgba(239, 68, 68, 0.2);" onclick="triggerCancelTrip('${trip.id}')"><i data-lucide="x-circle" style="width:12px; height:12px;"></i> Cancel</button>
          </div>
        </td>
      `;
      activeBody.appendChild(row);
    } else {
      const row = document.createElement("tr");
      const endLabel = trip.endTime ? new Date(trip.endTime).toLocaleString() : "N/A";
      const statusBadge = `<span class="badge badge-${trip.status === 'Completed' ? 'verified' : 'failed'}">${trip.status}</span>`;

      row.innerHTML = `
        <td><b>${trip.id}</b></td>
        <td>${trip.source} &rarr; ${trip.destination}</td>
        <td>${vehicle.registrationNumber}</td>
        <td>${driver.name}</td>
        <td>${trip.cargoWeight.toLocaleString()} kg</td>
        <td>${trip.startTime ? new Date(trip.startTime).toLocaleDateString() : 'N/A'}</td>
        <td>${endLabel}</td>
        <td>${statusBadge}</td>
      `;
      historicalBody.appendChild(row);
    }
  });

  enforceRbacAccess();
  lucide.createIcons();
}

window.triggerDispatchTrip = async function(tripId) {
  const db = window.db;
  try {
    await db.dispatchTrip(tripId);
    window.showToast(`Trip ${tripId} has been successfully dispatched! Both vehicle and driver set to On Trip.`, "success");
    await renderActiveView();
  } catch (err) {
    window.showToast(err.message, "danger");
  }
};

window.triggerCancelTrip = async function(tripId) {
  if (confirm(`Are you sure you want to cancel Trip ${tripId}?`)) {
    const db = window.db;
    try {
      await db.cancelTrip(tripId);
      window.showToast(`Trip ${tripId} cancelled successfully.`, "success");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  }
};

// ----------------------------------------------------
// TELEMETRY LIVE FEED
// ----------------------------------------------------
async function renderLiveTrackingFeed() {
  const db = window.db;
  const feed = document.getElementById("live-feed-updates");
  if (!feed) return;

  const trips = (await db.getTrips()).filter(t => t.status === "On Trip");
  if (trips.length === 0) {
    feed.innerHTML = '<div style="font-size:11px; color:var(--text-muted);">No active trips carrying cargo currently.</div>';
    return;
  }

  feed.innerHTML = "";
  trips.forEach(trip => {
    const progressPercent = Math.round((trip.routeIndex / trip.routeCoordinates.length) * 100);
    const log = document.createElement("div");
    log.style.borderBottom = "1px solid var(--border-color)";
    log.style.paddingBottom = "8px";
    log.style.marginBottom = "6px";
    log.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600;">
        <span>Trip ID: ${trip.id}</span>
        <span style="color:var(--primary);">${progressPercent}% Completed</span>
      </div>
      <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">
        Speed: <b>${trip.speed} km/h</b> | Dev status: <b>${trip.routeDeviation ? 'Deviated' : 'On route'}</b>
      </div>
    `;
    feed.appendChild(log);
  });
}

// ----------------------------------------------------
// MAINTENANCE MODULE VIEW
// ----------------------------------------------------
async function renderMaintenanceTables() {
  const db = window.db;
  const activeBody = document.getElementById("active-maintenance-body");
  const completedBody = document.getElementById("completed-maintenance-body");
  if (!activeBody || !completedBody) return;

  activeBody.innerHTML = "";
  completedBody.innerHTML = "";

  const list = await db.getMaintenance();
  const vehicles = await db.getVehicles();

  list.forEach(m => {
    const vehicle = vehicles.find(v => v.id === m.vehicleId);
    if (!vehicle) return;

    if (m.status === "Active") {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><b>${m.id}</b></td>
        <td>${vehicle.registrationNumber} (${vehicle.model})</td>
        <td>${m.type}</td>
        <td>${m.description}</td>
        <td>${m.scheduledDate}</td>
        <td>${m.cost.toLocaleString()} INR</td>
        <td>
          <button class="btn-primary maint-action-controls" style="padding:4px 8px; font-size:11px;" onclick="triggerMaintDone('${m.id}')"><i data-lucide="check" style="width:12px; height:12px;"></i> Complete Servicing</button>
        </td>
      `;
      activeBody.appendChild(row);
    } else {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><b>${m.id}</b></td>
        <td>${vehicle.registrationNumber}</td>
        <td>${m.type}</td>
        <td>${m.description}</td>
        <td>${m.scheduledDate}</td>
        <td>${m.completionDate}</td>
        <td>${m.cost.toLocaleString()} INR</td>
      `;
      completedBody.appendChild(row);
    }
  });

  enforceRbacAccess();
  lucide.createIcons();
}

window.triggerMaintDone = async function(maintId) {
  const db = window.db;
  try {
    await db.completeMaintenance(maintId);
    window.showToast(`Completed maintenance job ${maintId}. Vehicle released.`, "success");
    await renderActiveView();
  } catch (err) {
    window.showToast(err.message, "danger");
  }
};

// ----------------------------------------------------
// EXPENSE & ROI VIEW
// ----------------------------------------------------
async function renderExpensesLedger() {
  const db = window.db;
  const body = document.getElementById("expense-table-body");
  const filterVehicle = document.getElementById("expense-filter-vehicle");
  const filterType = document.getElementById("expense-filter-type");

  if (!body) return;

  const vehicles = await db.getVehicles();
  
  // Populate vehicle dropdown filter if empty
  if (filterVehicle && filterVehicle.options.length <= 1) {
    vehicles.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.registrationNumber;
      filterVehicle.appendChild(opt);
    });
  }

  body.innerHTML = "";

  const expenses = await db.getExpenses();
  const searchVehicle = filterVehicle.value;
  const searchType = filterType.value;

  let totalEarnings = 0;
  let totalExpenses = 0;

  expenses.forEach(e => {
    if (e.type === "Income") {
      totalEarnings += parseFloat(e.amount);
    } else {
      totalExpenses += parseFloat(e.amount);
    }

    const matchesVehicle = searchVehicle === "All" || e.vehicleId === searchVehicle;
    const matchesType = searchType === "All" || e.type === searchType;

    if (!matchesVehicle || !matchesType) return;

    const v = vehicles.find(veh => veh.id === e.vehicleId);
    const sign = e.type === "Income" ? "+" : "-";
    const colorStyle = e.type === "Income" ? "color:var(--success); font-weight:bold;" : "";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><b>${e.id.split("_")[0]}</b></td>
      <td>${e.date}</td>
      <td>${v ? v.registrationNumber : 'Unknown'}</td>
      <td>${e.tripId || 'N/A'}</td>
      <td><span class="badge" style="background-color:rgba(107,114,128,0.1);">${e.type}</span></td>
      <td>${e.description}</td>
      <td style="text-align:right; ${colorStyle}"><b>${sign} ${e.amount.toLocaleString()} INR</b></td>
    `;
    body.appendChild(row);
  });

  const netProfit = totalEarnings - totalExpenses;

  document.getElementById("kpi-earnings").textContent = `${totalEarnings.toLocaleString()} INR`;
  document.getElementById("kpi-total-expenses").textContent = `${totalExpenses.toLocaleString()} INR`;
  
  const profitEl = document.getElementById("kpi-net-profit");
  profitEl.textContent = `${netProfit.toLocaleString()} INR`;
  profitEl.style.color = netProfit >= 0 ? "var(--success)" : "var(--danger)";
}

// ----------------------------------------------------
// DRIVER IDENTITY VERIFICATION MODULE
// ----------------------------------------------------
async function renderVerificationDriversDropdown() {
  const db = window.db;
  const dropdown = document.getElementById("quick-verify-select");
  if (!dropdown) return;

  dropdown.innerHTML = '<option value="">-- Choose Driver --</option>';

  const drivers = await db.getDrivers();
  drivers.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.licenseNumber;
    opt.textContent = `${d.name} (${d.licenseNumber})`;
    dropdown.appendChild(opt);
  });
}

async function executeDriverVerifySearch() {
  const db = window.db;
  const inputVal = document.getElementById("verify-search-input").value.trim();
  const container = document.getElementById("verification-result-container");

  if (!inputVal) {
    window.showToast("Please enter a driving license number to search.", "warning");
    return;
  }

  const drivers = await db.getDrivers();
  const driver = drivers.find(d => d.licenseNumber.toLowerCase() === inputVal.toLowerCase());
  
  if (!driver) {
    container.style.display = "block";
    container.innerHTML = `
      <div class="panel-card" style="text-align:center; padding:30px; border-color:var(--danger);">
        <i data-lucide="shield-x" style="width:48px; height:48px; color:var(--danger); display:inline-block; margin-bottom:12px;"></i>
        <h3 style="color:var(--danger); margin-bottom:8px;">Verification Alert</h3>
        <p style="font-size:13px; color:var(--text-secondary);">
          No driver matches the license number: <b>${inputVal}</b>.
        </p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const isLicenseExpired = new Date(driver.licenseExpiry) < window.CURRENT_DATE;
  const verifyIcon = driver.verificationStatus === "Verified" ? "shield-check" : driver.verificationStatus === "Pending" ? "shield-alert" : "shield-x";
  const verifyColor = driver.verificationStatus === "Verified" ? "var(--success)" : driver.verificationStatus === "Pending" ? "var(--warning)" : "var(--danger)";

  container.style.display = "block";
  container.innerHTML = `
    <div class="panel-card" style="border: 2px solid ${verifyColor};">
      <div class="verification-badge-container">
        <i data-lucide="${verifyIcon}" style="width:36px; height:36px; color:${verifyColor};"></i>
        <div>
          <h3 style="color:${verifyColor}; font-size:18px;">Profile ${driver.verificationStatus} Badge</h3>
          <span style="font-size:11px; color:var(--text-muted);">TransitOps Security Registry Office</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:100px 1fr; gap:16px; margin-top:12px;">
        <img src="${driver.photo}" alt="${driver.name}" style="width:100px; height:100px; border-radius:8px; object-fit:cover; border:2px solid ${verifyColor}">
        <div style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
          <div>Driver Name: <b>${driver.name}</b></div>
          <div>Driving License Number: <b>${driver.licenseNumber}</b></div>
          <div>License Expiry: <b style="color:${isLicenseExpired ? 'var(--danger)' : 'inherit'}">${driver.licenseExpiry} ${isLicenseExpired ? '(EXPIRED)' : '(Valid)'}</b></div>
          <div>Government identity: <b>${driver.governmentId} (Verified check)</b></div>
          <div>Safety Performance Score: <b style="color:${driver.safetyScore >= 85 ? 'var(--success)' : 'var(--warning)'}">${driver.safetyScore}/100</b></div>
        </div>
      </div>
      
      <div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; font-size:12px; margin-top:10px;">
        <b>Passenger Trust Emergency Contact:</b> ${driver.emergencyContact}
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ----------------------------------------------------
// SYSTEM AUDIT LOGS
// ----------------------------------------------------
async function renderAuditLogsTable() {
  const db = window.db;
  const body = document.getElementById("audit-logs-body");
  if (!body) return;
  body.innerHTML = "";

  const logs = await db.getLogs();
  logs.forEach(log => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span style="color:var(--text-muted);">${new Date(log.timestamp).toLocaleString()}</span></td>
      <td><code>${log.userId}</code></td>
      <td><span class="badge" style="background-color:var(--bg-tertiary);">${log.userRole}</span></td>
      <td><b>${log.action}</b></td>
      <td>${log.details}</td>
    `;
    body.appendChild(row);
  });
}

// ----------------------------------------------------
// CLIENT-SIDE VALIDATION CHECKS
// ----------------------------------------------------
const BRAND_CHECK_LIST = [
  "tata", "mahindra", "bharatbenz", "ashok leyland", "eicher", "volvo",
  "scania", "isuzu", "toyota", "force", "maruti", "hyundai", "honda",
  "bajaj", "piaggio", "ford", "chevrolet", "tvs", "hero"
];

function performClientVehicleValidation(vehicle) {
  // 1. Model Brand Check
  const modelName = vehicle.model.toLowerCase();
  const isValidBrand = BRAND_CHECK_LIST.some(brand => modelName.includes(brand));
  if (!isValidBrand) {
    throw new Error(`Invalid manufacturer model '${vehicle.model}'. Model name must contain a recognized brand (e.g. Tata, Mahindra, Toyota, Bajaj, Piaggio, Eicher, Volvo, Hyundai, Maruti).`);
  }

  // 2. Doc Expiry Date Checks (Must be >= July 12, 2026 reference date)
  const refDate = window.CURRENT_DATE;
  const insDate = new Date(vehicle.insuranceExpiry);
  const fitDate = new Date(vehicle.fitnessExpiry);
  const permDate = new Date(vehicle.permitExpiry);

  if (insDate < refDate) {
    throw new Error(`Insurance certificate date (${vehicle.insuranceExpiry}) is expired. Registration requires active compliance dates (post July 12, 2026).`);
  }
  if (fitDate < refDate) {
    throw new Error(`Fitness certificate date (${vehicle.fitnessExpiry}) is expired. Registration requires active compliance dates (post July 12, 2026).`);
  }
  if (permDate < refDate) {
    throw new Error(`State permit date (${vehicle.permitExpiry}) is expired. Registration requires active compliance dates (post July 12, 2026).`);
  }
}

function performClientDriverValidation(driver) {
  // 1. Name Check (Minimum 3 chars, letters/spaces only)
  const nameRegex = /^[a-zA-Z\s]{3,}$/;
  if (!nameRegex.test(driver.name)) {
    throw new Error("Driver name must be at least 3 characters and contain only alphabetic characters.");
  }

  // 2. License Number Check (8-16 alphanumeric chars)
  const dlRegex = /^[a-zA-Z0-9-]{8,16}$/;
  if (!dlRegex.test(driver.licenseNumber.replace(/\s+/g, ""))) {
    throw new Error("Invalid driving license format. License must be a valid alphanumeric string of 8-16 characters.");
  }

  // 3. Expiry date check
  const refDate = window.CURRENT_DATE;
  const licDate = new Date(driver.licenseExpiry);
  if (licDate < refDate) {
    throw new Error(`Driving license date (${driver.licenseExpiry}) is expired. Onboarding requires valid document expiries (post July 12, 2026).`);
  }
}

// ----------------------------------------------------
// COMPONENT STATE MANAGEMENT (MODALS & FILTERS)
// ----------------------------------------------------
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

window.closeModal = closeModal;

// Setup event listeners for forms
function initFormListeners() {
  const db = window.db;

  // 1. VEHICLE FORM SUBMIT
  document.getElementById("vehicle-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("vehicle-id").value;
    
    const vehicle = {
      registrationNumber: document.getElementById("vehicle-reg").value.trim().toUpperCase(),
      model: document.getElementById("vehicle-model").value.trim(),
      type: document.getElementById("vehicle-type").value,
      maxLoad: parseFloat(document.getElementById("vehicle-load").value),
      odometer: parseFloat(document.getElementById("vehicle-odometer").value),
      acquisitionCost: parseFloat(document.getElementById("vehicle-cost").value),
      insuranceExpiry: document.getElementById("vehicle-insurance").value,
      fitnessExpiry: document.getElementById("vehicle-fitness").value,
      permitExpiry: document.getElementById("vehicle-permit").value,
      region: document.getElementById("vehicle-region").value,
      specifications: document.getElementById("vehicle-specs").value.trim()
    };

    if (id) vehicle.id = id;

    try {
      // Client-side strict validations check
      performClientVehicleValidation(vehicle);

      await db.saveVehicle(vehicle);
      window.showToast("Vehicle registry saved successfully.", "success");
      closeModal("modal-vehicle");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // 2. DRIVER FORM SUBMIT
  document.getElementById("driver-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("driver-id").value;

    const driver = {
      name: document.getElementById("driver-name").value.trim(),
      photo: document.getElementById("driver-photo").value.trim() || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
      licenseNumber: document.getElementById("driver-license").value.trim().toUpperCase(),
      licenseCategory: document.getElementById("driver-license-cat").value,
      licenseExpiry: document.getElementById("driver-license-exp").value,
      governmentId: document.getElementById("driver-govid").value.trim(),
      emergencyContact: document.getElementById("driver-emergency").value.trim(),
      contactNumber: document.getElementById("driver-contact").value.trim(),
      safetyScore: parseFloat(document.getElementById("driver-safety").value),
      experience: parseFloat(document.getElementById("driver-exp").value),
      verificationStatus: document.getElementById("driver-verify-status").value,
      status: document.getElementById("driver-status").value,
      drivingHistory: document.getElementById("driver-history").value.trim()
    };

    if (id) driver.id = id;

    try {
      // Client-side strict validations check
      performClientDriverValidation(driver);

      await db.saveDriver(driver);
      window.showToast("Driver profile saved successfully.", "success");
      closeModal("modal-driver");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // 3. TRIP DISPATCH SUBMIT (Saves as Draft first)
  document.getElementById("dispatch-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tripData = {
      source: document.getElementById("dispatch-source").value.trim(),
      destination: document.getElementById("dispatch-dest").value.trim(),
      vehicleId: document.getElementById("dispatch-vehicle").value,
      driverId: document.getElementById("dispatch-driver").value,
      cargoWeight: parseFloat(document.getElementById("dispatch-weight").value),
      plannedDistance: parseFloat(document.getElementById("dispatch-dist").value),
      estimatedDuration: parseFloat(document.getElementById("dispatch-duration").value),
      deliverySchedule: document.getElementById("dispatch-schedule").value
    };

    try {
      await db.createTrip(tripData);
      window.showToast("Draft trip registered successfully. Awaiting manual dispatch.", "success");
      closeModal("modal-dispatch");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // OPERATOR USER FORM SUBMIT
  document.getElementById("user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("user-id").value;

    const user = {
      name: document.getElementById("user-name-input").value.trim(),
      email: document.getElementById("user-email-input").value.trim(),
      username: document.getElementById("user-username-input").value.trim(),
      password: document.getElementById("user-password-input").value,
      role: document.getElementById("user-role-select").value
    };

    if (id) user.id = id;

    try {
      await db.saveUser(user);
      window.showToast("Operator account saved successfully.", "success");
      closeModal("modal-user");
      await renderUsersTable();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  document.getElementById("btn-add-user")?.addEventListener("click", () => {
    openUserModal();
  });

  // 4. MAINTENANCE SUBMIT
  document.getElementById("maintenance-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const record = {
      vehicleId: document.getElementById("maint-vehicle").value,
      type: document.getElementById("maint-type").value,
      cost: parseFloat(document.getElementById("maint-cost").value),
      scheduledDate: document.getElementById("maint-date").value,
      description: document.getElementById("maint-desc").value.trim()
    };

    try {
      await db.scheduleMaintenance(record);
      window.showToast("Servicing scheduled. Vehicle status changed to In Shop.", "success");
      closeModal("modal-maintenance");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // 5. EXPENSE SUBMIT
  document.getElementById("expense-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const expense = {
      vehicleId: document.getElementById("exp-vehicle").value,
      type: document.getElementById("exp-type").value,
      amount: parseFloat(document.getElementById("exp-amount").value),
      date: document.getElementById("exp-date").value,
      description: document.getElementById("exp-desc").value.trim()
    };

    if (expense.type === "Fuel") {
      expense.fuelLiters = parseFloat(document.getElementById("exp-liters").value) || null;
      expense.odometerReading = parseFloat(document.getElementById("exp-odometer").value) || null;
    }

    try {
      await db.addExpense(expense);
      window.showToast("Expense logged successfully.", "success");
      closeModal("modal-expense");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // 6. COMPLETE TRIP SUBMIT
  document.getElementById("complete-trip-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tripId = document.getElementById("complete-trip-id").value;
    const endOdometer = parseFloat(document.getElementById("complete-trip-odo").value);

    try {
      await db.completeTrip(tripId, endOdometer);
      window.showToast(`Trip ${tripId} marked as completed!`, "success");
      closeModal("modal-complete-trip");
      await renderActiveView();
    } catch (err) {
      window.showToast(err.message, "danger");
    }
  });

  // SEARCHES & FILTERS TRIGGER
  document.getElementById("vehicle-search")?.addEventListener("input", renderVehiclesTable);
  document.getElementById("vehicle-filter-status")?.addEventListener("change", renderVehiclesTable);
  document.getElementById("driver-search")?.addEventListener("input", renderDriversHub);
  document.getElementById("driver-filter-status")?.addEventListener("change", renderDriversHub);
  document.getElementById("driver-filter-verify")?.addEventListener("change", renderDriversHub);
  document.getElementById("expense-filter-vehicle")?.addEventListener("change", renderExpensesLedger);
  document.getElementById("expense-filter-type")?.addEventListener("change", renderExpensesLedger);

  // Trigger verify search
  document.getElementById("btn-run-verify-search")?.addEventListener("click", executeDriverVerifySearch);
  document.getElementById("quick-verify-select")?.addEventListener("change", (e) => {
    if (e.target.value) {
      document.getElementById("verify-search-input").value = e.target.value;
      executeDriverVerifySearch();
    }
  });

  // BUTTON CLICKS (MODAL TRIGGERS)
  document.getElementById("btn-add-vehicle")?.addEventListener("click", () => {
    document.getElementById("vehicle-form").reset();
    document.getElementById("vehicle-id").value = "";
    document.getElementById("vehicle-modal-title").textContent = "Register New Vehicle";
    
    // Autofill date defaults
    document.getElementById("vehicle-insurance").value = new Date(window.CURRENT_DATE.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    document.getElementById("vehicle-fitness").value = new Date(window.CURRENT_DATE.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    document.getElementById("vehicle-permit").value = new Date(window.CURRENT_DATE.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    openModal("modal-vehicle");
  });

  document.getElementById("btn-add-driver")?.addEventListener("click", () => {
    document.getElementById("driver-form").reset();
    document.getElementById("driver-id").value = "";
    document.getElementById("driver-modal-title").textContent = "Onboard New Driver";
    
    // Default license expiry 1 year future
    document.getElementById("driver-license-exp").value = new Date(window.CURRENT_DATE.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    openModal("modal-driver");
  });

  document.getElementById("btn-dispatch-trip")?.addEventListener("click", async () => {
    const vSelect = document.getElementById("dispatch-vehicle");
    const dSelect = document.getElementById("dispatch-driver");

    vSelect.innerHTML = '<option value="">-- Choose Vehicle --</option>';
    dSelect.innerHTML = '<option value="">-- Choose Driver --</option>';

    const vehicles = await db.getVehicles();
    const drivers = await db.getDrivers();

    vehicles.forEach(v => {
      if (v.status === "Available") {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.registrationNumber} (${v.model} - Max ${v.maxLoad}kg)`;
        vSelect.appendChild(opt);
      }
    });

    drivers.forEach(d => {
      const licenseExpired = new Date(d.licenseExpiry) < window.CURRENT_DATE;
      if (d.status === "Available" && d.verificationStatus === "Verified" && !licenseExpired) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.name} (${d.licenseCategory})`;
        dSelect.appendChild(opt);
      }
    });

    document.getElementById("dispatch-form").reset();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("dispatch-schedule").value = now.toISOString().slice(0, 16);

    openModal("modal-dispatch");
  });

  // Dashboard filter change triggers
  ["dashboard-filter-type", "dashboard-filter-status", "dashboard-filter-region"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", async () => {
      await renderDashboardKPIs();
    });
  });

  document.getElementById("btn-schedule-maint")?.addEventListener("click", async () => {
    const vSelect = document.getElementById("maint-vehicle");
    vSelect.innerHTML = '<option value="">-- Choose Vehicle --</option>';
    const vehicles = await db.getVehicles();
    vehicles.forEach(v => {
      if (v.status === "Available") {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.registrationNumber} (${v.model})`;
        vSelect.appendChild(opt);
      }
    });

    document.getElementById("maintenance-form").reset();
    document.getElementById("maint-date").value = new Date().toISOString().split("T")[0];
    openModal("modal-maintenance");
  });

  document.getElementById("btn-add-expense")?.addEventListener("click", async () => {
    const vSelect = document.getElementById("exp-vehicle");
    vSelect.innerHTML = '<option value="">-- Choose Vehicle --</option>';
    const vehicles = await db.getVehicles();
    vehicles.forEach(v => {
      if (v.status !== "Retired") {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.registrationNumber} (${v.model})`;
        vSelect.appendChild(opt);
      }
    });

    document.getElementById("expense-form").reset();
    toggleFuelExpenseFields();
    
    document.getElementById("exp-date").value = new Date().toISOString().split("T")[0];
    openModal("modal-expense");
  });

  // CSV Export Listener
  document.getElementById("btn-export-csv")?.addEventListener("click", async () => {
    const db = window.db;
    const expenses = await db.getExpenses();
    
    if (expenses.length === 0) {
      window.showToast("No expense ledger entries to export.", "warning");
      return;
    }

    const headers = ["Expense ID", "Date", "Vehicle ID", "Trip ID", "Category", "Description", "Amount (INR)", "Fuel Liters", "Odometer Reading"];
    const rows = expenses.map(e => [
      e.id,
      e.date,
      e.vehicleId,
      e.tripId || "N/A",
      e.type,
      e.description,
      e.amount,
      e.fuelLiters || "",
      e.odometerReading || ""
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transitops_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast("Ledger CSV downloaded successfully.", "success");
  });

  // PDF / Print Statement Listener
  document.getElementById("btn-export-pdf")?.addEventListener("click", () => {
    window.print();
  });
}

// ----------------------------------------------------
// SIMULATING ROLE-BASED ACCESS CONTROL (RBAC)
// ----------------------------------------------------
function enforceRbacAccess() {
  const db = window.db;
  if (!db || !db.getCurrentUser()) return;

  const currentRole = db.getCurrentUser().role;

  // Define permitted views for each persona
  const roleViews = {
    "Admin": ["dashboard", "vehicles", "drivers", "trips", "tracking", "maintenance", "expenses", "verification", "logs", "users"],
    "Fleet Manager": ["dashboard", "vehicles", "maintenance", "expenses"],
    "Driver": ["dashboard", "trips", "tracking"],
    "Safety Officer": ["dashboard", "drivers", "verification"],
    "Financial Analyst": ["dashboard", "expenses"],
    "Dispatch Manager": ["dashboard", "trips", "tracking"]
  };

  const allowedViews = roleViews[currentRole] || ["dashboard"];

  // Toggle sidebar navigation items visibility
  const navItems = document.querySelectorAll(".nav-links .nav-item");
  navItems.forEach(item => {
    const viewName = item.getAttribute("data-view");
    if (allowedViews.includes(viewName)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });

  // Redirect if current view is not allowed
  const activeNavItem = document.querySelector(".nav-links .nav-item.active");
  if (activeNavItem) {
    const activeView = activeNavItem.getAttribute("data-view");
    if (!allowedViews.includes(activeView)) {
      let redirectNavItem = null;
      for (const item of navItems) {
        if (allowedViews.includes(item.getAttribute("data-view"))) {
          redirectNavItem = item;
          break;
        }
      }
      if (redirectNavItem) {
        redirectNavItem.click();
        return; // Click handler will trigger renderActiveView again
      }
    }
  }

  // Helper selectors
  const addVehicleBtn = document.getElementById("btn-add-vehicle");
  const editVehicleBtns = document.querySelectorAll(".edit-vehicle-btn");
  const addDriverBtn = document.getElementById("btn-add-driver");
  const editDriverBtns = document.querySelectorAll(".edit-driver-btn");
  const dispatchBtn = document.getElementById("btn-dispatch-trip");
  const dispatchActionControls = document.querySelectorAll(".dispatch-action-controls");
  const scheduleMaintBtn = document.getElementById("btn-schedule-maint");
  const maintActionControls = document.querySelectorAll(".maint-action-controls");
  const addExpenseBtn = document.getElementById("btn-add-expense");

  // Reset all fields
  if (addVehicleBtn) addVehicleBtn.style.display = "inline-flex";
  editVehicleBtns.forEach(b => b.style.display = "inline-flex");
  if (addDriverBtn) addDriverBtn.style.display = "inline-flex";
  editDriverBtns.forEach(b => b.style.display = "inline-flex");
  if (dispatchBtn) dispatchBtn.style.display = "inline-flex";
  dispatchActionControls.forEach(b => b.style.display = "flex");
  if (scheduleMaintBtn) scheduleMaintBtn.style.display = "inline-flex";
  maintActionControls.forEach(b => b.style.display = "inline-flex");
  if (addExpenseBtn) addExpenseBtn.style.display = "inline-flex";

  // Hide or restrict items depending on roles
  if (currentRole === "Driver") {
    if (addVehicleBtn) addVehicleBtn.style.display = "none";
    editVehicleBtns.forEach(b => b.style.display = "none");
    if (addDriverBtn) addDriverBtn.style.display = "none";
    editDriverBtns.forEach(b => b.style.display = "none");
    if (scheduleMaintBtn) scheduleMaintBtn.style.display = "none";
    maintActionControls.forEach(b => b.style.display = "none");
    if (addExpenseBtn) addExpenseBtn.style.display = "none";
    if (dispatchBtn) dispatchBtn.style.display = "none";
  } 
  else if (currentRole === "Financial Analyst") {
    if (addVehicleBtn) addVehicleBtn.style.display = "none";
    editVehicleBtns.forEach(b => b.style.display = "none");
    if (addDriverBtn) addDriverBtn.style.display = "none";
    editDriverBtns.forEach(b => b.style.display = "none");
    if (dispatchBtn) dispatchBtn.style.display = "none";
    dispatchActionControls.forEach(b => b.style.display = "none");
    if (scheduleMaintBtn) scheduleMaintBtn.style.display = "none";
    maintActionControls.forEach(b => b.style.display = "none");
  } 
  else if (currentRole === "Safety Officer") {
    if (addVehicleBtn) addVehicleBtn.style.display = "none";
    editVehicleBtns.forEach(b => b.style.display = "none");
    if (dispatchBtn) dispatchBtn.style.display = "none";
    dispatchActionControls.forEach(b => b.style.display = "none");
    if (scheduleMaintBtn) scheduleMaintBtn.style.display = "none";
    maintActionControls.forEach(b => b.style.display = "none");
    if (addExpenseBtn) addExpenseBtn.style.display = "none";
  }
  else if (currentRole === "Dispatch Manager") {
    if (addVehicleBtn) addVehicleBtn.style.display = "none";
    editVehicleBtns.forEach(b => b.style.display = "none");
    if (addDriverBtn) addDriverBtn.style.display = "none";
    editDriverBtns.forEach(b => b.style.display = "none");
    if (scheduleMaintBtn) scheduleMaintBtn.style.display = "none";
    maintActionControls.forEach(b => b.style.display = "none");
    if (addExpenseBtn) addExpenseBtn.style.display = "none";
  }
  else if (currentRole === "Fleet Manager") {
    if (dispatchBtn) dispatchBtn.style.display = "none";
    dispatchActionControls.forEach(b => b.style.display = "none");
  }
}

// ----------------------------------------------------
// STYLING THEME & MODE TOGGLE
// ----------------------------------------------------
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle-btn");
  const icon = document.getElementById("theme-icon");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const targetTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", targetTheme);
    icon.setAttribute("data-lucide", targetTheme === "dark" ? "sun" : "moon");
    
    lucide.createIcons();

    if (window.updateChartsTheme) {
      window.updateChartsTheme(targetTheme === "dark");
    }
  });
}

// Helper function to hide/show fuel-specific form elements
function toggleFuelExpenseFields() {
  const select = document.getElementById("exp-type");
  const fuelFields = document.getElementById("fuel-fields");
  if (select && fuelFields) {
    fuelFields.style.display = select.value === "Fuel" ? "contents" : "none";
  }
}
window.toggleFuelExpenseFields = toggleFuelExpenseFields;

// ----------------------------------------------------
// USER MANAGEMENT PANEL (Admin Only)
// ----------------------------------------------------
async function renderUsersTable() {
  const db = window.db;
  const currentUser = db.getCurrentUser();
  if (!currentUser || currentUser.role !== "Admin") {
    window.showToast("Access Denied: Admin privileges required.", "danger");
    return;
  }

  const usersTableBody = document.getElementById("users-table-body");
  if (!usersTableBody) return;

  usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading operators...</td></tr>`;

  try {
    const list = await db.getUsers();
    usersTableBody.innerHTML = "";

    if (list.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No operator profiles registered.</td></tr>`;
      return;
    }

    list.forEach(u => {
      const tr = document.createElement("tr");
      const isSelf = u.id === currentUser.id;
      const isPrimaryAdmin = u.id === "U001";

      tr.innerHTML = `
        <td><span class="badge badge-info">${u.id}</span></td>
        <td><strong>${u.name}</strong> ${isSelf ? '<span style="font-size:10px; color:var(--primary);"> (You)</span>' : ''}</td>
        <td>${u.email}</td>
        <td><code>${u.username}</code></td>
        <td><span class="badge ${u.role === 'Admin' ? 'badge-primary' : 'badge-secondary'}">${u.role}</span></td>
        <td style="text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn-secondary edit-user-btn" style="padding:4px 8px; font-size:11px;" data-id="${u.id}"><i data-lucide="edit-3" style="width:12px; height:12px;"></i> Edit</button>
            ${!isPrimaryAdmin && !isSelf ? `
              <button class="btn-secondary delete-user-btn" style="padding:4px 8px; font-size:11px; color:var(--danger); border-color:rgba(239,68,68,0.2);" data-id="${u.id}"><i data-lucide="trash-2" style="width:12px; height:12px;"></i> Delete</button>
            ` : ''}
          </div>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    // Bind edit/delete clicks
    document.querySelectorAll(".edit-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-id");
        const matched = list.find(x => x.id === userId);
        if (matched) {
          openUserModal(matched);
        }
      });
    });

    document.querySelectorAll(".delete-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-id");
        if (confirm("Are you sure you want to delete this operator account?")) {
          try {
            await db.deleteUser(userId);
            window.showToast("Operator account deleted successfully.", "success");
            await renderUsersTable();
          } catch (err) {
            window.showToast(err.message, "danger");
          }
        }
      });
    });

    lucide.createIcons();

  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
  }
}

function openUserModal(user = null) {
  const modal = document.getElementById("modal-user");
  const title = document.getElementById("user-modal-title");
  const idInput = document.getElementById("user-id");
  const nameInput = document.getElementById("user-name-input");
  const emailInput = document.getElementById("user-email-input");
  const usernameInput = document.getElementById("user-username-input");
  const passwordInput = document.getElementById("user-password-input");
  const roleSelect = document.getElementById("user-role-select");

  if (!modal) return;

  if (user) {
    title.textContent = "Edit Operator Account";
    idInput.value = user.id;
    nameInput.value = user.name;
    emailInput.value = user.email;
    usernameInput.value = user.username;
    passwordInput.value = user.password;
    roleSelect.value = user.role;
    passwordInput.required = false; // password optional on edit
  } else {
    title.textContent = "Add Operator Account";
    idInput.value = "";
    nameInput.value = "";
    emailInput.value = "";
    usernameInput.value = "";
    passwordInput.value = "";
    roleSelect.value = "Driver";
    passwordInput.required = true; // password required on new
  }

  modal.style.display = "flex";
}
