require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const { User, Vehicle, Driver, Trip, Maintenance, FuelLog, Expense, Block } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const PORT = process.env.PORT || 5000;

/* =========================================================================
   BLOCKCHAIN AUDIT LEDGER
   Every business-critical event (dispatch, completion, cancellation,
   maintenance open/close) is written as an immutable, hash-chained block.
   This gives TransitOps a tamper-evident audit trail: any attempt to alter
   historical operational data breaks the hash chain and is detectable.
   ========================================================================= */
function computeHash({ index, timestamp, eventType, data, actor, previousHash }) {
  const payload = index + timestamp + eventType + JSON.stringify(data) + actor + previousHash;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function addBlock(eventType, data, actor = 'system') {
  const last = await Block.findOne().sort({ index: -1 });
  const index = last ? last.index + 1 : 0;
  const previousHash = last ? last.hash : '0'.repeat(64);
  const timestamp = new Date();
  const hash = computeHash({ index, timestamp: timestamp.toISOString(), eventType, data, actor, previousHash });
  const block = await Block.create({ index, timestamp, eventType, data, actor, previousHash, hash });
  return block;
}

async function verifyChain() {
  const blocks = await Block.find().sort({ index: 1 });
  let previousHash = '0'.repeat(64);
  for (const b of blocks) {
    const recomputed = computeHash({
      index: b.index,
      timestamp: b.timestamp.toISOString(),
      eventType: b.eventType,
      data: b.data,
      actor: b.actor,
      previousHash
    });
    if (recomputed !== b.hash || b.previousHash !== previousHash) {
      return { valid: false, brokenAt: b.index };
    }
    previousHash = b.hash;
  }
  return { valid: true, blocks: blocks.length };
}

/* =========================================================================
   AUTH MIDDLEWARE
   ========================================================================= */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied for role ${req.user.role}` });
    }
    next();
  };
}

// Turns Mongo/Mongoose errors into readable API messages instead of leaking stack internals.
function friendlyError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return `A record with that ${field} already exists`;
  }
  if (err.name === 'ValidationError') {
    return Object.values(err.errors).map(e => e.message).join('; ');
  }
  if (err.name === 'CastError') {
    return `Invalid value for ${err.path}`;
  }
  return err.message;
}

/* =========================================================================
   AUTH ROUTES
   ========================================================================= */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, role are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const validRoles = ['FleetManager', 'Driver', 'SafetyOfficer', 'FinancialAnalyst'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role });
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: friendlyError(err) });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

/* =========================================================================
   DASHBOARD
   Supports optional ?type=&status=&region= filters (spec 3.2) that scope
   every KPI to the matching subset of the fleet.
   ========================================================================= */
app.get('/api/dashboard', authenticate, async (req, res) => {
  try {
    const { type, status, region } = req.query;
    const baseFilter = {};
    if (type) baseFilter.type = type;
    if (region) baseFilter.region = region;

    const scopedFilter = { ...baseFilter };
    if (status) scopedFilter.status = status;

    const [totalVehicles, availableVehicles, inShop, retired, onTripVehicles] = await Promise.all([
      Vehicle.countDocuments({ ...scopedFilter, status: { $ne: 'Retired', ...(status ? { $eq: status } : {}) } }),
      Vehicle.countDocuments({ ...baseFilter, status: 'Available' }),
      Vehicle.countDocuments({ ...baseFilter, status: 'In Shop' }),
      Vehicle.countDocuments({ ...baseFilter, status: 'Retired' }),
      Vehicle.countDocuments({ ...baseFilter, status: 'On Trip' })
    ]);

    const vehicleIdsInScope = region || type ? (await Vehicle.find(baseFilter, '_id')).map(v => v._id) : null;
    const tripFilter = vehicleIdsInScope ? { vehicle: { $in: vehicleIdsInScope } } : {};

    const [activeTrips, pendingTrips, driversOnDuty] = await Promise.all([
      Trip.countDocuments({ ...tripFilter, status: 'Dispatched' }),
      Trip.countDocuments({ ...tripFilter, status: 'Draft' }),
      Driver.countDocuments({ status: 'On Trip' })
    ]);

    const totalForUtilization = totalVehicles > 0 ? totalVehicles : await Vehicle.countDocuments({ ...baseFilter, status: { $ne: 'Retired' } });
    const utilization = totalForUtilization > 0 ? ((onTripVehicles / totalForUtilization) * 100).toFixed(1) : '0.0';

    res.json({
      activeVehicles: await Vehicle.countDocuments({ ...baseFilter, status: { $ne: 'Retired' } }),
      availableVehicles,
      vehiclesInMaintenance: inShop,
      retiredVehicles: retired,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      fleetUtilization: Number(utilization)
    });
  } catch (err) {
    res.status(500).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   VEHICLE REGISTRY
   ========================================================================= */
app.get('/api/vehicles', authenticate, async (req, res) => {
  const { type, status, region } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (region) filter.region = region;
  const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 });
  res.json(vehicles);
});

app.get('/api/vehicles/regions', authenticate, async (req, res) => {
  const regions = await Vehicle.distinct('region', { region: { $ne: '' } });
  res.json(regions.filter(Boolean).sort());
});

app.post('/api/vehicles', authenticate, authorize('FleetManager'), async (req, res) => {
  try {
    const { regNumber, maxLoadCapacity, acquisitionCost } = req.body;
    if (!regNumber || !maxLoadCapacity || acquisitionCost === undefined) {
      return res.status(400).json({ error: 'regNumber, maxLoadCapacity and acquisitionCost are required' });
    }
    const existing = await Vehicle.findOne({ regNumber: regNumber.toUpperCase().trim() });
    if (existing) return res.status(409).json({ error: 'Registration number already exists' });
    const vehicle = await Vehicle.create(req.body);
    await addBlock('VEHICLE_REGISTERED', { vehicleId: vehicle._id, regNumber: vehicle.regNumber }, req.user.name);
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.put('/api/vehicles/:id', authenticate, authorize('FleetManager'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.delete('/api/vehicles/:id', authenticate, authorize('FleetManager'), async (req, res) => {
  const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ message: 'Vehicle deleted' });
});

/* =========================================================================
   DRIVER MANAGEMENT
   ========================================================================= */
app.get('/api/drivers', authenticate, async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const drivers = await Driver.find(filter).sort({ createdAt: -1 });
  res.json(drivers);
});

app.post('/api/drivers', authenticate, authorize('FleetManager', 'SafetyOfficer'), async (req, res) => {
  try {
    const { name, licenseNumber, licenseCategory, licenseExpiry, contact } = req.body;
    if (!name || !licenseNumber || !licenseCategory || !licenseExpiry || !contact) {
      return res.status(400).json({ error: 'name, licenseNumber, licenseCategory, licenseExpiry and contact are required' });
    }
    const existing = await Driver.findOne({ licenseNumber: licenseNumber.trim() });
    if (existing) return res.status(409).json({ error: 'License number already registered' });
    const driver = await Driver.create(req.body);
    await addBlock('DRIVER_REGISTERED', { driverId: driver._id, licenseNumber: driver.licenseNumber }, req.user.name);
    res.status(201).json(driver);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.put('/api/drivers/:id', authenticate, authorize('FleetManager', 'SafetyOfficer'), async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.delete('/api/drivers/:id', authenticate, authorize('FleetManager', 'SafetyOfficer'), async (req, res) => {
  const driver = await Driver.findByIdAndDelete(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  res.json({ message: 'Driver deleted' });
});

/* =========================================================================
   TRIP MANAGEMENT (with mandatory business rules)
   ========================================================================= */
app.get('/api/trips', authenticate, async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const trips = await Trip.find(filter).populate('vehicle').populate('driver').sort({ createdAt: -1 });
  res.json(trips);
});

app.post('/api/trips', authenticate, async (req, res) => {
  try {
    const { source, destination, vehicle: vehicleId, driver: driverId, cargoWeight, plannedDistance } = req.body;
    if (!source || !destination || !vehicleId || !driverId || cargoWeight === undefined || plannedDistance === undefined) {
      return res.status(400).json({ error: 'source, destination, vehicle, driver, cargoWeight and plannedDistance are required' });
    }
    const vehicle = await Vehicle.findById(vehicleId);
    const driver = await Driver.findById(driverId);
    if (!vehicle || !driver) return res.status(404).json({ error: 'Vehicle or driver not found' });

    if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
      return res.status(400).json({ error: 'Vehicle is Retired or In Shop and cannot be selected for dispatch' });
    }
    if (vehicle.status === 'On Trip') {
      return res.status(400).json({ error: 'Vehicle is already assigned to another trip' });
    }
    if (driver.status === 'Suspended') {
      return res.status(400).json({ error: 'Driver is Suspended and cannot be assigned to trips' });
    }
    if (driver.status === 'On Trip') {
      return res.status(400).json({ error: 'Driver is already assigned to another trip' });
    }
    if (new Date(driver.licenseExpiry) < new Date()) {
      return res.status(400).json({ error: 'Driver license has expired' });
    }
    if (cargoWeight > vehicle.maxLoadCapacity) {
      return res.status(400).json({ error: `Cargo weight (${cargoWeight}kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity}kg)` });
    }

    const trip = await Trip.create({ source, destination, vehicle: vehicleId, driver: driverId, cargoWeight, plannedDistance, status: 'Draft' });
    res.status(201).json(trip);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.post('/api/trips/:id/dispatch', authenticate, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.status !== 'Draft') return res.status(400).json({ error: 'Only Draft trips can be dispatched' });

    const { vehicle, driver } = trip;
    if (!vehicle || !driver) return res.status(400).json({ error: 'Trip is missing a vehicle or driver reference' });
    if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
      return res.status(400).json({ error: 'Vehicle is Retired or In Shop and cannot be dispatched' });
    }
    if (vehicle.status !== 'Available') return res.status(400).json({ error: 'Vehicle is not Available' });
    if (driver.status === 'Suspended') return res.status(400).json({ error: 'Driver is Suspended' });
    if (driver.status !== 'Available') return res.status(400).json({ error: 'Driver is not Available' });
    if (new Date(driver.licenseExpiry) < new Date()) {
      return res.status(400).json({ error: 'Driver license has expired' });
    }
    if (trip.cargoWeight > vehicle.maxLoadCapacity) {
      return res.status(400).json({ error: 'Cargo weight exceeds vehicle max load capacity' });
    }

    trip.status = 'Dispatched';
    trip.dispatchedAt = new Date();
    await trip.save();
    vehicle.status = 'On Trip';
    driver.status = 'On Trip';
    await vehicle.save();
    await driver.save();

    await addBlock('TRIP_DISPATCHED', { tripId: trip._id, vehicle: vehicle.regNumber, driver: driver.name }, req.user.name);
    res.json(trip);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.post('/api/trips/:id/complete', authenticate, async (req, res) => {
  try {
    const { actualDistance, fuelConsumed, revenue, finalOdometer } = req.body;
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.status !== 'Dispatched') return res.status(400).json({ error: 'Only Dispatched trips can be completed' });

    trip.status = 'Completed';
    trip.actualDistance = actualDistance || trip.plannedDistance;
    trip.fuelConsumed = fuelConsumed || 0;
    trip.revenue = revenue || 0;
    trip.completedAt = new Date();
    await trip.save();

    const vehicle = trip.vehicle;
    vehicle.status = 'Available';
    if (finalOdometer) vehicle.odometer = finalOdometer;
    else vehicle.odometer += trip.actualDistance;
    await vehicle.save();

    const driver = trip.driver;
    driver.status = 'Available';
    await driver.save();

    if (fuelConsumed) {
      await FuelLog.create({ vehicle: vehicle._id, liters: fuelConsumed, cost: 0, date: new Date() });
    }

    await addBlock('TRIP_COMPLETED', { tripId: trip._id, vehicle: vehicle.regNumber, driver: driver.name, distance: trip.actualDistance }, req.user.name);
    res.json(trip);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.post('/api/trips/:id/cancel', authenticate, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!['Draft', 'Dispatched'].includes(trip.status)) {
      return res.status(400).json({ error: 'Only Draft or Dispatched trips can be cancelled' });
    }

    const wasDispatched = trip.status === 'Dispatched';
    trip.status = 'Cancelled';
    await trip.save();

    if (wasDispatched) {
      trip.vehicle.status = 'Available';
      trip.driver.status = 'Available';
      await trip.vehicle.save();
      await trip.driver.save();
    }

    await addBlock('TRIP_CANCELLED', { tripId: trip._id }, req.user.name);
    res.json(trip);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   MAINTENANCE
   ========================================================================= */
app.get('/api/maintenance', authenticate, async (req, res) => {
  const logs = await Maintenance.find().populate('vehicle').sort({ createdAt: -1 });
  res.json(logs);
});

app.post('/api/maintenance', authenticate, authorize('FleetManager'), async (req, res) => {
  try {
    const { vehicle: vehicleId, description, cost } = req.body;
    if (!vehicleId || !description || cost === undefined) {
      return res.status(400).json({ error: 'vehicle, description and cost are required' });
    }
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.status === 'Retired') return res.status(400).json({ error: 'Cannot open a maintenance record for a Retired vehicle' });
    if (vehicle.status === 'On Trip') return res.status(400).json({ error: 'Vehicle is currently On Trip and cannot enter maintenance' });

    const log = await Maintenance.create({
      vehicle: vehicleId, description, cost, odometerAtService: vehicle.odometer, status: 'Active'
    });

    vehicle.status = 'In Shop';
    vehicle.odometerAtLastService = vehicle.odometer;
    await vehicle.save();

    await addBlock('MAINTENANCE_OPENED', { maintenanceId: log._id, vehicle: vehicle.regNumber, description }, req.user.name);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.post('/api/maintenance/:id/close', authenticate, authorize('FleetManager'), async (req, res) => {
  try {
    const log = await Maintenance.findById(req.params.id).populate('vehicle');
    if (!log) return res.status(404).json({ error: 'Maintenance log not found' });
    if (log.status === 'Closed') return res.status(400).json({ error: 'Maintenance record already closed' });

    log.status = 'Closed';
    log.closedAt = new Date();
    await log.save();

    if (log.vehicle.status !== 'Retired') {
      log.vehicle.status = 'Available';
      await log.vehicle.save();
    }

    await addBlock('MAINTENANCE_CLOSED', { maintenanceId: log._id, vehicle: log.vehicle.regNumber }, req.user.name);
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   FUEL LOGS & EXPENSES
   ========================================================================= */
app.get('/api/fuel', authenticate, async (req, res) => {
  const logs = await FuelLog.find().populate('vehicle').sort({ date: -1 });
  res.json(logs);
});

app.post('/api/fuel', authenticate, async (req, res) => {
  try {
    const { vehicle: vehicleId, liters, cost } = req.body;
    if (!vehicleId || liters === undefined || cost === undefined) {
      return res.status(400).json({ error: 'vehicle, liters and cost are required' });
    }
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const log = await FuelLog.create(req.body);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

app.get('/api/expenses', authenticate, async (req, res) => {
  const expenses = await Expense.find().populate('vehicle').sort({ date: -1 });
  res.json(expenses);
});

app.post('/api/expenses', authenticate, async (req, res) => {
  try {
    const { vehicle: vehicleId, type, cost } = req.body;
    if (!vehicleId || !type || cost === undefined) {
      return res.status(400).json({ error: 'vehicle, type and cost are required' });
    }
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   REPORTS & ANALYTICS
   ========================================================================= */
async function buildReport() {
  const vehicles = await Vehicle.find();
  const report = [];
  for (const v of vehicles) {
    const [fuelLogs, maintLogs, trips] = await Promise.all([
      FuelLog.find({ vehicle: v._id }),
      Maintenance.find({ vehicle: v._id }),
      Trip.find({ vehicle: v._id, status: 'Completed' })
    ]);
    const totalFuel = fuelLogs.reduce((s, f) => s + f.liters, 0);
    const totalFuelCost = fuelLogs.reduce((s, f) => s + f.cost, 0);
    const totalMaintCost = maintLogs.reduce((s, m) => s + m.cost, 0);
    const totalDistance = trips.reduce((s, t) => s + t.actualDistance, 0);
    const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
    const fuelEfficiency = totalFuel > 0 ? +(totalDistance / totalFuel).toFixed(2) : 0;
    const operationalCost = +(totalFuelCost + totalMaintCost).toFixed(2);
    const roi = v.acquisitionCost > 0
      ? +(((totalRevenue - operationalCost) / v.acquisitionCost) * 100).toFixed(2)
      : 0;
    report.push({
      vehicleId: v._id, regNumber: v.regNumber, name: v.name, type: v.type,
      totalDistance, totalFuel, fuelEfficiency, operationalCost, totalRevenue, roiPercent: roi
    });
  }
  return report;
}

app.get('/api/reports', authenticate, async (req, res) => {
  try {
    res.json(await buildReport());
  } catch (err) {
    res.status(500).json({ error: friendlyError(err) });
  }
});

app.get('/api/reports/csv', authenticate, async (req, res) => {
  try {
    const report = await buildReport();
    const header = 'Registration,Name,Type,TotalDistanceKm,TotalFuelL,FuelEfficiencyKmPerL,OperationalCost,Revenue,ROI(%)\n';
    const rows = report.map(r =>
      [r.regNumber, `"${r.name.replace(/"/g, '""')}"`, r.type, r.totalDistance, r.totalFuel, r.fuelEfficiency, r.operationalCost, r.totalRevenue, r.roiPercent].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transitops_report.csv');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   AI INSIGHTS ENGINE
   Rule-based / statistical AI layer (no external API key required):
     1. Predictive maintenance   - flags vehicles overdue based on odometer
        distance travelled since last service vs a configurable threshold.
     2. Fuel anomaly detection   - flags vehicles whose fuel efficiency is
        significantly below the fleet average (possible leak / bad driving /
        data entry error).
     3. License expiry risk     - flags drivers whose license expires soon.
     4. Driver safety risk      - flags drivers with low safety scores.
     5. Utilization insight     - flags an under-utilized fleet.
   ========================================================================= */
const SERVICE_INTERVAL_KM = 5000;
const LICENSE_WARNING_DAYS = 30;
const SAFETY_SCORE_THRESHOLD = 60;
const FUEL_ANOMALY_RATIO = 0.7; // below 70% of fleet average efficiency

app.get('/api/ai/insights', authenticate, async (req, res) => {
  try {
    const insights = [];

    // 1. Predictive maintenance
    const vehicles = await Vehicle.find({ status: { $ne: 'Retired' } });
    for (const v of vehicles) {
      const kmSinceService = v.odometer - (v.odometerAtLastService || 0);
      if (kmSinceService >= SERVICE_INTERVAL_KM) {
        insights.push({
          type: 'PREDICTIVE_MAINTENANCE',
          severity: kmSinceService >= SERVICE_INTERVAL_KM * 1.5 ? 'high' : 'medium',
          message: `${v.regNumber} (${v.name}) has travelled ${kmSinceService}km since last service — maintenance recommended.`
        });
      }
    }

    // 2. Fuel efficiency anomalies
    const report = await buildReport();
    const withFuel = report.filter(r => r.fuelEfficiency > 0);
    if (withFuel.length > 1) {
      const avgEfficiency = withFuel.reduce((s, r) => s + r.fuelEfficiency, 0) / withFuel.length;
      for (const r of withFuel) {
        if (r.fuelEfficiency < avgEfficiency * FUEL_ANOMALY_RATIO) {
          insights.push({
            type: 'FUEL_ANOMALY',
            severity: 'medium',
            message: `${r.regNumber} fuel efficiency (${r.fuelEfficiency} km/L) is well below fleet average (${avgEfficiency.toFixed(2)} km/L) — check for leaks or inefficient routing.`
          });
        }
      }
    }

    // 3. License expiry risk
    const drivers = await Driver.find();
    const now = new Date();
    for (const d of drivers) {
      const daysLeft = Math.ceil((new Date(d.licenseExpiry) - now) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        insights.push({ type: 'LICENSE_EXPIRED', severity: 'high', message: `${d.name}'s license expired ${Math.abs(daysLeft)} day(s) ago.` });
      } else if (daysLeft <= LICENSE_WARNING_DAYS) {
        insights.push({ type: 'LICENSE_EXPIRING', severity: 'medium', message: `${d.name}'s license expires in ${daysLeft} day(s) — renewal needed.` });
      }
    }

    // 4. Driver safety risk
    for (const d of drivers) {
      if (d.safetyScore < SAFETY_SCORE_THRESHOLD) {
        insights.push({ type: 'SAFETY_RISK', severity: 'high', message: `${d.name} has a low safety score (${d.safetyScore}/100) — consider retraining.` });
      }
    }

    // 5. Fleet utilization insight
    const totalVehicles = await Vehicle.countDocuments({ status: { $ne: 'Retired' } });
    const onTrip = await Vehicle.countDocuments({ status: 'On Trip' });
    const utilization = totalVehicles > 0 ? (onTrip / totalVehicles) * 100 : 0;
    if (utilization < 30 && totalVehicles > 0) {
      insights.push({ type: 'LOW_UTILIZATION', severity: 'low', message: `Fleet utilization is only ${utilization.toFixed(1)}% — consider reallocating idle vehicles or reviewing demand.` });
    }

    const severityRank = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    res.json({ generatedAt: new Date(), count: insights.length, insights });
  } catch (err) {
    res.status(500).json({ error: friendlyError(err) });
  }
});

/* =========================================================================
   BLOCKCHAIN LEDGER ROUTES
   ========================================================================= */
app.get('/api/blockchain/ledger', authenticate, async (req, res) => {
  const blocks = await Block.find().sort({ index: 1 });
  res.json(blocks);
});

app.get('/api/blockchain/verify', authenticate, async (req, res) => {
  const result = await verifyChain();
  res.json(result);
});

/* =========================================================================
   FALLBACK — serve the SPA shell for any non-API GET (deep links / refresh)
   ========================================================================= */
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================================================================
   DB CONNECTION + SERVER START
   ========================================================================= */
async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transitops';
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB:', uri);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Set MONGODB_URI in your .env file to a running MongoDB instance (local or Atlas).');
    process.exit(1);
  }

  const genesisExists = await Block.findOne({ index: 0 });
  if (!genesisExists) {
    const gTimestamp = new Date();
    const gData = { message: 'TransitOps blockchain audit ledger initialized' };
    const gHash = computeHash({ index: 0, timestamp: gTimestamp.toISOString(), eventType: 'GENESIS', data: gData, actor: 'system', previousHash: '0'.repeat(64) });
    await Block.create({
      index: 0,
      timestamp: gTimestamp,
      eventType: 'GENESIS',
      data: gData,
      actor: 'system',
      previousHash: '0'.repeat(64),
      hash: gHash
    });
    console.log('⛓️  Genesis block created');
  }

  app.listen(PORT, () => console.log(`🚚 TransitOps API running on http://localhost:${PORT}`));
}

start();
