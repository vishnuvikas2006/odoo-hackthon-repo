const API = '/api';
let TOKEN = localStorage.getItem('transitops_token') || null;
let USER = JSON.parse(localStorage.getItem('transitops_user') || 'null');
let charts = {};
let cache = { vehicles: [], drivers: [], trips: [], maintenance: [], fuel: [], expenses: [] };
let sortState = { vehicles: { key: 'regNumber', dir: 'asc' }, drivers: { key: 'name', dir: 'asc' } };

/* ---------------- API HELPER ---------------- */
async function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(API + path, { ...opts, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error((body && body.error) || 'Request failed');
  return body;
}

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function emptyRow(colspan, message) {
  return `<tr class="empty-row"><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

/* ---------------- AUTH ---------------- */
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
  });
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setSession(data);
  } catch (err) { errEl.textContent = err.message; }
});

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const password = document.getElementById('regPassword').value;
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }
  try {
    const payload = {
      name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      password,
      role: document.getElementById('regRole').value
    };
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    setSession(data);
  } catch (err) { errEl.textContent = err.message; }
});

function setSession(data) {
  TOKEN = data.token; USER = data.user;
  localStorage.setItem('transitops_token', TOKEN);
  localStorage.setItem('transitops_user', JSON.stringify(USER));
  boot();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  TOKEN = null; USER = null;
  localStorage.removeItem('transitops_token');
  localStorage.removeItem('transitops_user');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginForm').reset();
});

/* ---------------- DARK MODE ---------------- */
const darkToggle = document.getElementById('darkModeToggle');
darkToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('transitops_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});
if (localStorage.getItem('transitops_theme') === 'dark') document.body.classList.add('dark');

/* ---------------- NAVIGATION ---------------- */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.getElementById('viewTitle').textContent = document.querySelector(`.nav-item[data-view="${view}"]`).textContent.replace(/^\S+\s/, '');
  loadView(view);
}

async function loadView(view) {
  try {
    if (view === 'dashboard') await loadDashboard();
    if (view === 'vehicles') await loadVehicles();
    if (view === 'drivers') await loadDrivers();
    if (view === 'trips') await loadTrips();
    if (view === 'maintenance') await loadMaintenance();
    if (view === 'fuel') await loadFuelExpenses();
    if (view === 'reports') await loadReports();
    if (view === 'ai') await loadAI();
    if (view === 'ledger') await loadLedger();
  } catch (err) { toast(err.message, true); }
}

/* ---------------- MODALS ---------------- */
document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.modal;
    try {
      if (id === 'tripModal') await populateTripSelects();
      if (id === 'maintenanceModal') populateSelect('maintVehicleSelect', cache.vehicles.filter(v => v.status !== 'Retired' && v.status !== 'In Shop'), v => `${v.regNumber} — ${v.name}`);
      if (id === 'fuelModal') populateSelect('fuelVehicleSelect', cache.vehicles, v => `${v.regNumber} — ${v.name}`);
      if (id === 'expenseModal') populateSelect('expenseVehicleSelect', cache.vehicles, v => `${v.regNumber} — ${v.name}`);
      document.getElementById(id).classList.add('open');
    } catch (err) { toast(err.message, true); }
  });
});
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('open')));
document.querySelectorAll('.modal-overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); }));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(ov => ov.classList.remove('open'));
});

function populateSelect(id, items, labelFn) {
  const sel = document.getElementById(id);
  sel.innerHTML = items.length
    ? items.map(it => `<option value="${it._id}">${escapeHtml(labelFn(it))}</option>`).join('')
    : `<option value="" disabled selected>No eligible options available</option>`;
}
async function populateTripSelects() {
  populateSelect('tripVehicleSelect', cache.vehicles.filter(v => v.status === 'Available'), v => `${v.regNumber} — ${v.name} (max ${v.maxLoadCapacity}kg)`);
  populateSelect('tripDriverSelect', cache.drivers.filter(d => d.status === 'Available' && new Date(d.licenseExpiry) >= new Date()), d => `${d.name} — ${d.licenseNumber}`);
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
  return data;
}

/* -------- Vehicle form -------- */
document.getElementById('vehicleForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form);
    ['maxLoadCapacity', 'odometer', 'acquisitionCost'].forEach(k => { if (payload[k] !== undefined) payload[k] = Number(payload[k]); });
    await api('/vehicles', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Vehicle registered'); await loadVehicles();
  } catch (err) { errEl.textContent = err.message; }
});

/* -------- Driver form -------- */
document.getElementById('driverForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form);
    if (payload.safetyScore !== undefined) payload.safetyScore = Number(payload.safetyScore);
    await api('/drivers', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Driver added'); await loadDrivers();
  } catch (err) { errEl.textContent = err.message; }
});

/* -------- Trip form -------- */
document.getElementById('tripForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form);
    ['cargoWeight', 'plannedDistance'].forEach(k => payload[k] = Number(payload[k]));
    await api('/trips', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Trip created as Draft'); await loadTrips(); await loadVehicles(); await loadDrivers();
  } catch (err) { errEl.textContent = err.message; }
});

document.getElementById('completeTripForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form);
    const id = payload.tripId; delete payload.tripId;
    ['actualDistance', 'fuelConsumed', 'revenue', 'finalOdometer'].forEach(k => { if (payload[k] !== undefined) payload[k] = Number(payload[k]); });
    await api(`/trips/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Trip completed'); await loadTrips(); await loadVehicles(); await loadDrivers();
  } catch (err) { errEl.textContent = err.message; }
});

/* -------- Maintenance form -------- */
document.getElementById('maintenanceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form); payload.cost = Number(payload.cost);
    await api('/maintenance', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Maintenance record created — vehicle set to In Shop'); await loadMaintenance(); await loadVehicles();
  } catch (err) { errEl.textContent = err.message; }
});

/* -------- Fuel / Expense forms -------- */
document.getElementById('fuelForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form); payload.liters = Number(payload.liters); payload.cost = Number(payload.cost);
    await api('/fuel', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Fuel log saved'); await loadFuelExpenses();
  } catch (err) { errEl.textContent = err.message; }
});

document.getElementById('expenseForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const errEl = form.querySelector('.form-error'); errEl.textContent = '';
  try {
    const payload = formData(form); payload.cost = Number(payload.cost);
    await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
    form.closest('.modal-overlay').classList.remove('open'); form.reset();
    toast('Expense saved'); await loadFuelExpenses();
  } catch (err) { errEl.textContent = err.message; }
});

/* ---------------- DASHBOARD ---------------- */
document.getElementById('dashTypeFilter').addEventListener('change', loadDashboard);
document.getElementById('dashStatusFilter').addEventListener('change', loadDashboard);
document.getElementById('dashRegionFilter').addEventListener('change', loadDashboard);
document.getElementById('dashFilterReset').addEventListener('click', () => {
  document.getElementById('dashTypeFilter').value = '';
  document.getElementById('dashStatusFilter').value = '';
  document.getElementById('dashRegionFilter').value = '';
  loadDashboard();
});

async function populateDashboardRegions() {
  try {
    const regions = await api('/vehicles/regions');
    const sel = document.getElementById('dashRegionFilter');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Regions</option>' + regions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    sel.value = current;
  } catch (err) { /* non-fatal */ }
}

async function loadDashboard() {
  await populateDashboardRegions();
  const type = document.getElementById('dashTypeFilter').value;
  const status = document.getElementById('dashStatusFilter').value;
  const region = document.getElementById('dashRegionFilter').value;
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (region) params.set('region', region);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const kpi = await api(`/dashboard${qs}`);
  const grid = document.getElementById('kpiGrid');
  const items = [
    ['Active Vehicles', kpi.activeVehicles], ['Available', kpi.availableVehicles],
    ['In Maintenance', kpi.vehiclesInMaintenance], ['Active Trips', kpi.activeTrips],
    ['Pending Trips', kpi.pendingTrips], ['Drivers On Duty', kpi.driversOnDuty],
    ['Fleet Utilization', kpi.fleetUtilization + '%']
  ];
  grid.innerHTML = items.map(([label, value], i) => `
    <div class="kpi-card ${i === items.length - 1 ? 'accent' : ''}">
      <div class="label">${label}</div><div class="value">${value}</div>
    </div>`).join('');

  await Promise.all([loadVehiclesQuiet(), loadTripsQuiet()]);

  const scopedVehicles = cache.vehicles.filter(v =>
    (!type || v.type === type) && (!status || v.status === status) && (!region || v.region === region)
  );
  const scopedVehicleIds = new Set(scopedVehicles.map(v => v._id));

  const statusCounts = { Available: 0, 'On Trip': 0, 'In Shop': 0, Retired: 0 };
  scopedVehicles.forEach(v => statusCounts[v.status]++);
  renderChart('fleetStatusChart', 'doughnut', Object.keys(statusCounts), Object.values(statusCounts), ['#15803D', '#0E7490', '#D97706', '#B42318']);

  const tripCounts = { Draft: 0, Dispatched: 0, Completed: 0, Cancelled: 0 };
  cache.trips.forEach(t => { if (!type && !region || scopedVehicleIds.has(t.vehicle?._id)) tripCounts[t.status]++; });
  renderChart('tripPipelineChart', 'bar', Object.keys(tripCounts), Object.values(tripCounts), ['#D97706', '#0E7490', '#15803D', '#B42318']);
}

function renderChart(id, type, labels, data, colors) {
  const ctx = document.getElementById(id);
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type, data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: type === 'bar' ? { y: { beginAtZero: true } } : {} }
  });
}

async function loadVehiclesQuiet() { cache.vehicles = await api('/vehicles'); }
async function loadTripsQuiet() { cache.trips = await api('/trips'); }

/* ---------------- SORTING ---------------- */
function attachSortHandlers(tableId, key, renderFn) {
  document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
    th.setAttribute('tabindex', '0');
    const activate = () => {
      const field = th.dataset.sort;
      const state = sortState[key];
      if (state.key === field) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.key = field; state.dir = 'asc'; }
      document.querySelectorAll(`#${tableId} th.sortable`).forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      renderFn();
    };
    th.addEventListener('click', activate);
    th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    if (sortState[key].key === th.dataset.sort) th.classList.add(sortState[key].dir === 'asc' ? 'sort-asc' : 'sort-desc');
  });
}
function sortRows(rows, state) {
  const { key, dir } = state;
  const sorted = [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'licenseExpiry') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

/* ---------------- VEHICLES ---------------- */
async function loadVehicles() {
  cache.vehicles = await api('/vehicles');
  attachSortHandlers('vehicleTable', 'vehicles', renderVehicleTable);
  renderVehicleTable();
}
document.getElementById('vehicleSearch').addEventListener('input', renderVehicleTable);
document.getElementById('vehicleStatusFilter').addEventListener('change', renderVehicleTable);

function renderVehicleTable() {
  const q = document.getElementById('vehicleSearch').value.toLowerCase();
  const statusF = document.getElementById('vehicleStatusFilter').value;
  let rows = cache.vehicles.filter(v =>
    (!statusF || v.status === statusF) &&
    (v.regNumber.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
  );
  rows = sortRows(rows, sortState.vehicles);
  document.querySelector('#vehicleTable tbody').innerHTML = rows.map(v => `
    <tr>
      <td class="mono">${escapeHtml(v.regNumber)}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.type)}</td>
      <td class="mono">${v.maxLoadCapacity}</td><td class="mono">${v.odometer}</td>
      <td><span class="badge badge-${v.status.replace(/\s/g, '')}">${v.status}</span></td>
      <td>${escapeHtml(v.region) || '—'}</td>
      <td class="row-actions">
        ${v.status !== 'Retired' ? `<button onclick="retireVehicle('${v._id}')" class="danger">Retire</button>` : ''}
      </td>
    </tr>`).join('') || emptyRow(8, 'No vehicles found');
}
async function retireVehicle(id) {
  if (!confirm('Retire this vehicle? It will be removed from dispatch selection.')) return;
  try { await api(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Retired' }) }); toast('Vehicle retired'); await loadVehicles(); }
  catch (err) { toast(err.message, true); }
}

/* ---------------- DRIVERS ---------------- */
async function loadDrivers() {
  cache.drivers = await api('/drivers');
  attachSortHandlers('driverTable', 'drivers', renderDriverTable);
  renderDriverTable();
}
document.getElementById('driverSearch').addEventListener('input', renderDriverTable);
document.getElementById('driverStatusFilter').addEventListener('change', renderDriverTable);
function renderDriverTable() {
  const q = document.getElementById('driverSearch').value.toLowerCase();
  const statusF = document.getElementById('driverStatusFilter').value;
  let rows = cache.drivers.filter(d =>
    (!statusF || d.status === statusF) &&
    (d.name.toLowerCase().includes(q) || d.licenseNumber.toLowerCase().includes(q))
  );
  rows = sortRows(rows, sortState.drivers);
  document.querySelector('#driverTable tbody').innerHTML = rows.map(d => {
    const expired = new Date(d.licenseExpiry) < new Date();
    const actions = [];
    if (d.status !== 'Suspended') actions.push(`<button onclick="setDriverStatus('${d._id}','Suspended')" class="danger">Suspend</button>`);
    else actions.push(`<button onclick="setDriverStatus('${d._id}','Available')" class="go">Reinstate</button>`);
    if (d.status === 'Available') actions.push(`<button onclick="setDriverStatus('${d._id}','Off Duty')" class="warn">Off Duty</button>`);
    if (d.status === 'Off Duty') actions.push(`<button onclick="setDriverStatus('${d._id}','Available')" class="go">On Duty</button>`);
    return `<tr>
      <td>${escapeHtml(d.name)}</td><td class="mono">${escapeHtml(d.licenseNumber)}</td><td>${escapeHtml(d.licenseCategory)}</td>
      <td class="mono" style="${expired ? 'color:var(--red);font-weight:700' : ''}">${new Date(d.licenseExpiry).toLocaleDateString()}</td>
      <td class="mono">${d.safetyScore}</td>
      <td><span class="badge badge-${d.status.replace(/\s/g, '')}">${d.status}</span></td>
      <td class="row-actions">${actions.join('')}</td>
    </tr>`;
  }).join('') || emptyRow(7, 'No drivers found');
}
async function setDriverStatus(id, status) {
  try { await api(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Driver status updated'); await loadDrivers(); }
  catch (err) { toast(err.message, true); }
}

/* ---------------- TRIPS ---------------- */
async function loadTrips() {
  cache.trips = await api('/trips');
  renderTripTable();
}
function renderTripTable() {
  const q = document.getElementById('tripSearch').value.toLowerCase();
  const statusF = document.getElementById('tripStatusFilter').value;
  const rows = cache.trips.filter(t =>
    (!statusF || t.status === statusF) &&
    (t.source.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q))
  );
  document.querySelector('#tripTable tbody').innerHTML = rows.map(t => `
    <tr>
      <td>${escapeHtml(t.source)} → ${escapeHtml(t.destination)}</td>
      <td class="mono">${t.vehicle?.regNumber || '—'}</td>
      <td>${t.driver?.name || '—'}</td>
      <td class="mono">${t.cargoWeight}</td>
      <td class="mono">${t.status === 'Completed' ? t.actualDistance : t.plannedDistance} km</td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td class="row-actions">
        ${t.status === 'Draft' ? `<button onclick="dispatchTrip('${t._id}')" class="go">Dispatch</button><button onclick="cancelTrip('${t._id}')" class="danger">Cancel</button>` : ''}
        ${t.status === 'Dispatched' ? `<button onclick="openCompleteModal('${t._id}')" class="go">Complete</button><button onclick="cancelTrip('${t._id}')" class="danger">Cancel</button>` : ''}
      </td>
    </tr>`).join('') || emptyRow(7, 'No trips found');
}
document.getElementById('tripStatusFilter').addEventListener('change', renderTripTable);
document.getElementById('tripSearch').addEventListener('input', renderTripTable);

async function dispatchTrip(id) {
  try { await api(`/trips/${id}/dispatch`, { method: 'POST' }); toast('Trip dispatched'); await loadTrips(); await loadVehicles(); await loadDrivers(); }
  catch (err) { toast(err.message, true); }
}
async function cancelTrip(id) {
  if (!confirm('Cancel this trip?')) return;
  try { await api(`/trips/${id}/cancel`, { method: 'POST' }); toast('Trip cancelled'); await loadTrips(); await loadVehicles(); await loadDrivers(); }
  catch (err) { toast(err.message, true); }
}
function openCompleteModal(id) {
  document.querySelector('#completeTripForm [name="tripId"]').value = id;
  document.getElementById('completeTripModal').classList.add('open');
}

/* ---------------- MAINTENANCE ---------------- */
async function loadMaintenance() {
  cache.maintenance = await api('/maintenance');
  renderMaintenanceTable();
}
document.getElementById('maintStatusFilter').addEventListener('change', renderMaintenanceTable);
function renderMaintenanceTable() {
  const statusF = document.getElementById('maintStatusFilter').value;
  const rows = statusF ? cache.maintenance.filter(m => m.status === statusF) : cache.maintenance;
  document.querySelector('#maintenanceTable tbody').innerHTML = rows.map(m => `
    <tr>
      <td class="mono">${m.vehicle?.regNumber || '—'}</td><td>${escapeHtml(m.description)}</td>
      <td class="mono">${m.cost}</td><td class="mono">${m.odometerAtService}</td>
      <td><span class="badge badge-${m.status}">${m.status}</span></td>
      <td class="mono">${new Date(m.date).toLocaleDateString()}</td>
      <td class="row-actions">${m.status === 'Active' ? `<button onclick="closeMaintenance('${m._id}')" class="go">Close</button>` : ''}</td>
    </tr>`).join('') || emptyRow(7, 'No maintenance records');
}
async function closeMaintenance(id) {
  try { await api(`/maintenance/${id}/close`, { method: 'POST' }); toast('Maintenance closed — vehicle available'); await loadMaintenance(); await loadVehicles(); }
  catch (err) { toast(err.message, true); }
}

/* ---------------- FUEL & EXPENSES ---------------- */
async function loadFuelExpenses() {
  const [fuel, expenses] = await Promise.all([api('/fuel'), api('/expenses')]);
  cache.fuel = fuel; cache.expenses = expenses;
  document.querySelector('#fuelTable tbody').innerHTML = fuel.map(f => `
    <tr><td class="mono">${f.vehicle?.regNumber || '—'}</td><td class="mono">${f.liters}</td><td class="mono">${f.cost}</td><td class="mono">${new Date(f.date).toLocaleDateString()}</td></tr>`
  ).join('') || emptyRow(4, 'No fuel logs');
  document.querySelector('#expenseTable tbody').innerHTML = expenses.map(x => `
    <tr><td class="mono">${x.vehicle?.regNumber || '—'}</td><td>${escapeHtml(x.type)}</td><td class="mono">${x.cost}</td><td class="mono">${new Date(x.date).toLocaleDateString()}</td></tr>`
  ).join('') || emptyRow(4, 'No expenses');
}

/* ---------------- REPORTS ---------------- */
async function loadReports() {
  const report = await api('/reports');
  document.querySelector('#reportTable tbody').innerHTML = report.map(r => `
    <tr>
      <td class="mono">${r.regNumber}</td><td>${escapeHtml(r.type)}</td><td class="mono">${r.totalDistance}</td>
      <td class="mono">${r.totalFuel}</td><td class="mono">${r.fuelEfficiency}</td>
      <td class="mono">${r.operationalCost}</td><td class="mono">${r.totalRevenue}</td>
      <td class="mono" style="color:${r.roiPercent >= 0 ? 'var(--green)' : 'var(--red)'}">${r.roiPercent}%</td>
    </tr>`).join('') || emptyRow(8, 'No data yet');
  renderChart('roiChart', 'bar', report.map(r => r.regNumber), report.map(r => r.roiPercent), report.map(r => r.roiPercent >= 0 ? '#15803D' : '#B42318'));
}
document.getElementById('exportCsvBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch(API + '/reports/csv', { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transitops_report.csv'; a.click();
    URL.revokeObjectURL(url);
  } catch (err) { toast('Export failed', true); }
});

/* ---------------- AI INSIGHTS ---------------- */
 
/* ---------------- AI INSIGHTS ---------------- */
async function loadAI() {
  const list = document.getElementById('aiInsights');
  list.innerHTML = `<p class="hint">Analyzing fleet data…</p>`;
  try {
    const data = await api('/ai/insights');
    if (!data.insights.length) {
      list.innerHTML = `<div class="insight-card low"><div>✅ No issues detected — fleet operating within normal parameters.</div></div>`;
      return;
    }
    list.innerHTML = data.insights.map(i => `
      <div class="insight-card ${i.severity}">
        <span class="insight-tag">${escapeHtml(i.type.replace(/_/g, ' '))}</span>
        <div>${escapeHtml(i.message)}</div>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div class="insight-card high"><div>⚠️ Couldn't load insights: ${escapeHtml(err.message)}</div></div>`;
    toast(err.message, true);
  }
}
document.getElementById('refreshAiBtn').addEventListener('click', loadAI);
/* ---------------- BLOCKCHAIN LEDGER ---------------- */
async function loadLedger() {
  const blocks = await api('/blockchain/ledger');
  document.getElementById('ledgerList').innerHTML = blocks.slice().reverse().map(b => `
    <div class="block-card">
      <div class="block-head"><span>Block #${b.index} · ${escapeHtml(b.eventType)} · by ${escapeHtml(b.actor)}</span><strong>${new Date(b.timestamp).toLocaleString()}</strong></div>
      <div><span class="hash-label">data:</span> ${escapeHtml(JSON.stringify(b.data))}</div>
      <div class="hash"><span class="hash-label">prevHash:</span> ${b.previousHash.slice(0, 24)}…</div>
      <div class="hash"><span class="hash-label">hash:</span> ${b.hash.slice(0, 24)}…</div>
    </div>`).join('') || `<p class="hint">No ledger entries yet.</p>`;
  await refreshChainStatus();
}
document.getElementById('verifyChainBtn').addEventListener('click', async () => {
  await refreshChainStatus(true);
});
async function refreshChainStatus(announce = false) {
  const pill = document.getElementById('chainStatus');
  try {
    const result = await api('/blockchain/verify');
    if (result.valid) {
      pill.textContent = `⛓️ Chain valid (${result.blocks} blocks)`;
      pill.classList.remove('broken');
      if (announce) toast('Blockchain integrity verified ✓');
    } else {
      pill.textContent = `⚠️ Chain broken at block #${result.brokenAt}`;
      pill.classList.add('broken');
      if (announce) toast('Chain integrity check FAILED', true);
    }
  } catch (err) { /* ignore */ }
}

/* ---------------- BOOT ---------------- */
async function boot() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('userName').textContent = USER.name;
  document.getElementById('userRole').textContent = USER.role;
  await Promise.all([loadVehiclesQuiet(), loadDrivers().catch(() => {})]);
  switchView('dashboard');
  refreshChainStatus();
}

if (TOKEN && USER) boot();
