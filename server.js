// TransitOps - Full-Stack Express Server with Mongoose & Memory Fallbacks
// Date Context Reference: July 12, 2026

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/transitops";
const CURRENT_DATE = new Date("2026-07-12T09:45:00");

// Middleware
app.use(cors());
app.use(express.json());

// Mode Indicator
let isMemoryMode = false;

// ----------------------------------------------------
// DATABASE SCHEMAS & MODELS
// ----------------------------------------------------

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  driverId: { type: String }
});
const User = mongoose.model("User", UserSchema);

const VehicleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  registrationNumber: { type: String, required: true, unique: true },
  model: { type: String, required: true },
  type: { type: String, required: true, enum: ["Truck", "Van", "Bus", "Trailer", "Cab", "Auto"] },
  maxLoad: { type: Number, required: true }, // kg
  odometer: { type: Number, required: true }, // km
  acquisitionCost: { type: Number, required: true }, // INR
  status: { type: String, required: true, enum: ["Available", "On Trip", "In Shop", "Retired"], default: "Available" },
  insuranceExpiry: { type: String, required: true },
  fitnessExpiry: { type: String, required: true },
  permitExpiry: { type: String, required: true },
  specifications: { type: String },
  region: { type: String, default: "Pune" },
  supportingDocs: { type: Map, of: String }
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const DriverSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  photo: { type: String },
  licenseNumber: { type: String, required: true, unique: true },
  licenseCategory: { type: String, required: true },
  licenseExpiry: { type: String, required: true },
  governmentId: { type: String, required: true },
  emergencyContact: { type: String, required: true },
  contactNumber: { type: String, required: true },
  safetyScore: { type: Number, required: true, min: 0, max: 100, default: 90 },
  experience: { type: Number, required: true },
  verificationStatus: { type: String, required: true, enum: ["Verified", "Pending", "Failed"], default: "Pending" },
  status: { type: String, required: true, enum: ["Available", "On Trip", "Off Duty", "Suspended"], default: "Available" },
  drivingHistory: { type: String }
});
const Driver = mongoose.model("Driver", DriverSchema);

const TripSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  destination: { type: String, required: true },
  vehicleId: { type: String, required: true },
  driverId: { type: String, required: true },
  cargoWeight: { type: Number, required: true },
  plannedDistance: { type: Number, required: true },
  estimatedDuration: { type: Number, required: true },
  deliverySchedule: { type: String, required: true },
  status: { type: String, required: true, enum: ["Draft", "Dispatched", "Completed", "Cancelled"], default: "Draft" },
  startTime: { type: String },
  endTime: { type: String },
  routeIndex: { type: Number, default: 0 },
  speed: { type: Number, default: 0 },
  routeDeviation: { type: Boolean, default: false },
  geofenceAlerts: { type: [String], default: [] },
  routeCoordinates: { type: [[Number]], default: [] }
});
const Trip = mongoose.model("Trip", TripSchema);

const MaintenanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  vehicleId: { type: String, required: true },
  type: { type: String, required: true, enum: ["Preventive", "Corrective"] },
  description: { type: String, required: true },
  scheduledDate: { type: String, required: true },
  completionDate: { type: String },
  cost: { type: Number, required: true },
  status: { type: String, required: true, enum: ["Active", "Completed"], default: "Active" }
});
const Maintenance = mongoose.model("Maintenance", MaintenanceSchema);

const ExpenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  vehicleId: { type: String, required: true },
  tripId: { type: String },
  type: { type: String, required: true, enum: ["Fuel", "Maintenance", "Toll", "Repair", "Insurance", "Other", "Income"] },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  fuelLiters: { type: Number },
  odometerReading: { type: Number }
});
const Expense = mongoose.model("Expense", ExpenseSchema);

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, required: true },
  userRole: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true }
});
const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

// ----------------------------------------------------
// IN-MEMORY DATABASE ARRAYS (OFFLINE FALLBACK STATE)
// ----------------------------------------------------
let memUsers = [
  { id: "U001", username: "admin", name: "Sarah Jenkins", role: "Admin", email: "sarah.j@transitops.com", password: "admin123" },
  { id: "U002", username: "fleet_mgr", name: "David Vance", role: "Fleet Manager", email: "david.v@transitops.com", password: "password123" },
  { id: "U003", username: "dispatch_mgr", name: "Michael Chang", role: "Dispatch Manager", email: "michael.c@transitops.com", password: "password123" },
  { id: "U004", username: "driver_johnd", name: "John Doe", role: "Driver", email: "john.doe@transitops.com", password: "password123", driverId: "D001" },
  { id: "U005", username: "safety_off", name: "Elena Rostova", role: "Safety Officer", email: "elena.r@transitops.com", password: "password123" },
  { id: "U006", username: "fin_analyst", name: "Marcus Brody", role: "Financial Analyst", email: "marcus.b@transitops.com", password: "password123" }
];

let memVehicles = [
  { id: "V001", registrationNumber: "MH-12-QW-8842", model: "Tata Prima 4925.S", type: "Truck", maxLoad: 12000, odometer: 145200, acquisitionCost: 4500000, status: "Available", insuranceExpiry: "2027-03-15", fitnessExpiry: "2026-11-20", permitExpiry: "2027-01-10", region: "Pune", specifications: "250 HP Heavy Cargo Container Truck" },
  { id: "V002", registrationNumber: "MH-14-EU-4521", model: "Mahindra Bolero Pik-Up", type: "Van", maxLoad: 1500, odometer: 64100, acquisitionCost: 950000, status: "Available", insuranceExpiry: "2027-08-10", fitnessExpiry: "2027-05-30", permitExpiry: "2027-12-05", region: "Pune", specifications: "Flatbed pickup carrier" },
  { id: "V003", registrationNumber: "DL-1C-AA-9988", model: "BharatBenz 1917R", type: "Truck", maxLoad: 8000, odometer: 89300, acquisitionCost: 3200000, status: "In Shop", insuranceExpiry: "2027-05-02", fitnessExpiry: "2027-04-15", permitExpiry: "2027-06-25", region: "Delhi", specifications: "170 HP container" },
  { id: "V004", registrationNumber: "KA-03-MM-7112", model: "Ashok Leyland Dost+", type: "Van", maxLoad: 1250, odometer: 112000, acquisitionCost: 800000, status: "Retired", insuranceExpiry: "2025-12-31", fitnessExpiry: "2025-12-31", permitExpiry: "2025-12-31", region: "Bangalore", specifications: "Light Carrier" },
  { id: "V005", registrationNumber: "MH-43-BB-1122", model: "Eicher Pro 3015", type: "Truck", maxLoad: 5500, odometer: 42100, acquisitionCost: 2100000, status: "On Trip", insuranceExpiry: "2027-01-20", fitnessExpiry: "2026-10-15", permitExpiry: "2027-02-18", region: "Mumbai", specifications: "Dropside cargo carrier" },
  { id: "V006", registrationNumber: "MH-12-KA-5566", model: "Toyota Innova Crysta", type: "Cab", maxLoad: 600, odometer: 32400, acquisitionCost: 2200000, status: "Available", insuranceExpiry: "2027-04-20", fitnessExpiry: "2027-04-15", permitExpiry: "2027-09-10", region: "Pune", specifications: "7-Seater Passenger Cab" },
  { id: "V007", registrationNumber: "MH-12-RE-9900", model: "Bajaj RE Compact", type: "Auto", maxLoad: 350, odometer: 18100, acquisitionCost: 240000, status: "Available", insuranceExpiry: "2027-06-15", fitnessExpiry: "2027-05-10", permitExpiry: "2027-08-30", region: "Pune", specifications: "Passenger Auto-rickshaw" }
];

let memDrivers = [
  { id: "D001", name: "John Doe", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop", licenseNumber: "DL-1420180099411", licenseCategory: "Heavy Transport", licenseExpiry: "2028-09-12", governmentId: "Aadhaar: 4421-9980-1234", emergencyContact: "Jane Doe - +91 98765 43210", contactNumber: "+91 98765 00112", safetyScore: 94, experience: 8, verificationStatus: "Verified", status: "Available" },
  { id: "D002", name: "Rajesh Kumar", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop", licenseNumber: "DL-1220159982451", licenseCategory: "Heavy Transport", licenseExpiry: "2026-06-30", governmentId: "Aadhaar: 8872-1142-9900", emergencyContact: "Amit Kumar - +91 99112 23344", contactNumber: "+91 99112 23344", safetyScore: 88, experience: 11, verificationStatus: "Verified", status: "Available" },
  { id: "D003", name: "Vikram Singh", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop", licenseNumber: "DL-1920204481011", licenseCategory: "Light Vehicle", licenseExpiry: "2029-01-15", governmentId: "Aadhaar: 3312-5566-7788", emergencyContact: "Kiran Singh - +91 98112 88442", contactNumber: "+91 98112 88442", safetyScore: 97, experience: 6, verificationStatus: "Pending", status: "Available" }
];

let memTrips = [
  { id: "T001", source: "Mumbai Port Trust", destination: "Pune Logistics Hub", vehicleId: "V005", driverId: "D001", cargoWeight: 4500, plannedDistance: 150, estimatedDuration: 4, deliverySchedule: "2026-07-12T14:30:00", status: "Dispatched", startTime: "2026-07-12T08:00:00", routeIndex: 20, speed: 55, routeCoordinates: [[18.9486, 72.8468], [18.5204, 73.8567]] }
];

let memMaintenance = [
  { id: "M001", vehicleId: "V003", type: "Preventive", description: "Engine Diagnostics & Filter Swap", scheduledDate: "2026-07-10", cost: 15000, status: "Active" }
];

let memExpenses = [
  { id: "E001", vehicleId: "V005", tripId: "T001", type: "Fuel", amount: 6200, date: "2026-07-12", description: "Diesel Refuel 70L", fuelLiters: 70, odometerReading: 42080 },
  { id: "E002", vehicleId: "V003", type: "Maintenance", amount: 15000, date: "2026-07-10", description: "Scheduled diagnostics deposit M001" }
];

let memLogs = [
  { id: "L001", timestamp: new Date(), userId: "U001", userRole: "Admin", action: "Server Launch", details: "TransitOps memory log fallback initialized." }
];

const otpCache = {};

// Helper: Add Audit Log (supporting memory mode fallback)
async function addLog(userId, userRole, action, details) {
  const timestampString = new Date().toISOString();
  if (isMemoryMode) {
    memLogs.unshift({
      id: "L" + String(memLogs.length + 1).padStart(3, "0") + "_" + Date.now(),
      timestamp: new Date(),
      userId,
      userRole,
      action,
      details
    });
    return;
  }
  try {
    const count = await AuditLog.countDocuments();
    const log = new AuditLog({
      id: "L" + String(count + 1).padStart(3, "0") + "_" + Date.now(),
      userId,
      userRole,
      action,
      details
    });
    await log.save();
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

// ----------------------------------------------------
// MAIL TRANSPORT SERVICE (SMTP)
// ----------------------------------------------------
let mailTransporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ----------------------------------------------------
// VALIDATION ENGINES
// ----------------------------------------------------
const VALID_BRANDS = [
  "tata", "mahindra", "bharatbenz", "ashok leyland", "eicher", "volvo",
  "scania", "isuzu", "toyota", "force", "maruti", "hyundai", "honda",
  "bajaj", "piaggio", "ford", "chevrolet", "tvs", "hero"
];

function validateVehicleData(data) {
  const modelLower = (data.model || "").toLowerCase();
  const hasValidBrand = VALID_BRANDS.some(brand => modelLower.includes(brand));
  if (!hasValidBrand) {
    throw new Error(`Invalid manufacturer model '${data.model}'. Model name must contain a recognized brand (e.g. Tata, Mahindra, Toyota, Bajaj, Piaggio, Eicher, Volvo).`);
  }

  const validTypes = ["Truck", "Van", "Bus", "Trailer", "Cab", "Auto"];
  if (!validTypes.includes(data.type)) {
    throw new Error(`Invalid vehicle type '${data.type}'. Must be one of: Truck, Van, Bus, Trailer, Cab, Auto.`);
  }

  const insDate = new Date(data.insuranceExpiry);
  const fitDate = new Date(data.fitnessExpiry);
  const permDate = new Date(data.permitExpiry);

  if (insDate < CURRENT_DATE) {
    throw new Error(`Insurance certificate is already expired (Expiry: ${data.insuranceExpiry}).`);
  }
  if (fitDate < CURRENT_DATE) {
    throw new Error(`Fitness certificate is already expired (Expiry: ${data.fitnessExpiry}).`);
  }
  if (permDate < CURRENT_DATE) {
    throw new Error(`State permit certificate is already expired (Expiry: ${data.permitExpiry}).`);
  }
}

function validateDriverData(data) {
  const nameRegex = /^[a-zA-Z\s]{3,}$/;
  if (!nameRegex.test(data.name)) {
    throw new Error("Driver name must be at least 3 characters and contain only letters.");
  }

  const dlRegex = /^[a-zA-Z0-9-]{8,16}$/;
  if (!dlRegex.test(data.licenseNumber.replace(/\s+/g, ""))) {
    throw new Error("Invalid driving license format. Must be 8-16 alphanumeric characters.");
  }

  const licDate = new Date(data.licenseExpiry);
  if (licDate < CURRENT_DATE) {
    throw new Error(`Driving license is already expired (Expiry: ${data.licenseExpiry}).`);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. AUTHENTICATION & CREDENTIALS FLOW
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    let user;
    if (isMemoryMode) {
      user = memUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Direct password verification (for seeded and newly created users)
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    await addLog(user.id, user.role, "Operator Login", `Logged in successfully via password.`);
    return res.status(200).json({ status: "success", user });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// OPERATOR USER MANAGEMENT ENDPOINTS (Admin Only)
app.get("/api/users", async (req, res) => {
  const role = req.headers["operator-role"] || "Admin";
  if (role !== "Admin") {
    return res.status(403).json({ error: "Access Denied: Admin role required." });
  }

  if (isMemoryMode) return res.json(memUsers);
  try {
    const list = await User.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  const userData = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  if (role !== "Admin") {
    return res.status(403).json({ error: "Access Denied: Admin role required." });
  }

  if (!userData.email || !userData.password || !userData.name || !userData.role) {
    return res.status(400).json({ error: "All operator fields are required." });
  }

  try {
    if (isMemoryMode) {
      if (userData.id) {
        const dup = memUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase() && u.id !== userData.id);
        if (dup) throw new Error("Email address already registered.");
        const idx = memUsers.findIndex(u => u.id === userData.id);
        memUsers[idx] = { ...memUsers[idx], ...userData };
        res.json(memUsers[idx]);
      } else {
        const dup = memUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
        if (dup) throw new Error("Email address already registered.");
        userData.id = "U" + String(memUsers.length + 1).padStart(3, "0");
        memUsers.push(userData);
        res.json(userData);
      }
      await addLog(operator, role, "Save User (Memory)", `Saved user account for ${userData.email}`);
      return;
    }

    let user;
    if (userData.id) {
      const dup = await User.findOne({ email: userData.email.toLowerCase(), id: { $ne: userData.id } });
      if (dup) throw new Error("Email address already registered.");
      user = await User.findOneAndUpdate({ id: userData.id }, userData, { new: true });
    } else {
      const dup = await User.findOne({ email: userData.email.toLowerCase() });
      if (dup) throw new Error("Email address already registered.");
      const count = await User.countDocuments();
      userData.id = "U" + String(count + 1).padStart(3, "0");
      user = new User(userData);
      await user.save();
    }
    await addLog(operator, role, "Save User", `Saved operator user details for ${user.email}`);
    res.json(user);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  if (role !== "Admin") {
    return res.status(403).json({ error: "Access Denied: Admin role required." });
  }

  if (id === "U001") {
    return res.status(400).json({ error: "Primary system administrator account cannot be deleted." });
  }

  try {
    if (isMemoryMode) {
      const idx = memUsers.findIndex(u => u.id === id);
      if (idx === -1) throw new Error("User not found.");
      const deleted = memUsers.splice(idx, 1)[0];
      await addLog(operator, role, "Delete User (Memory)", `Deleted operator ${deleted.email}`);
      return res.json({ status: "success", message: "Operator deleted successfully." });
    }

    const user = await User.findOneAndDelete({ id });
    if (!user) throw new Error("User not found.");
    await addLog(operator, role, "Delete User", `Deleted operator ${user.email}`);
    res.json({ status: "success", message: "Operator deleted successfully." });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. VEHICLE ENDPOINTS
app.get("/api/vehicles", async (req, res) => {
  if (isMemoryMode) return res.json(memVehicles);
  try {
    const list = await Vehicle.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/vehicles", async (req, res) => {
  const vehicleData = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    validateVehicleData(vehicleData);

    if (isMemoryMode) {
      if (vehicleData.id) {
        const dup = memVehicles.find(v => v.registrationNumber === vehicleData.registrationNumber.toUpperCase() && v.id !== vehicleData.id);
        if (dup) throw new Error(`Vehicle registration number ${vehicleData.registrationNumber} is already registered.`);
        const idx = memVehicles.findIndex(v => v.id === vehicleData.id);
        memVehicles[idx] = { ...memVehicles[idx], ...vehicleData };
        res.json(memVehicles[idx]);
      } else {
        const dup = memVehicles.find(v => v.registrationNumber === vehicleData.registrationNumber.toUpperCase());
        if (dup) throw new Error(`Vehicle registration number ${vehicleData.registrationNumber} is already registered.`);
        vehicleData.id = "V" + String(memVehicles.length + 1).padStart(3, "0");
        vehicleData.registrationNumber = vehicleData.registrationNumber.toUpperCase();
        vehicleData.status = "Available";
        memVehicles.push(vehicleData);
        res.json(vehicleData);
      }
      await addLog(operator, role, "Save Vehicle (Memory)", `Saved vehicle specs for ${vehicleData.registrationNumber}`);
      return;
    }

    let vehicle;
    if (vehicleData.id) {
      const duplicate = await Vehicle.findOne({ registrationNumber: vehicleData.registrationNumber.toUpperCase(), id: { $ne: vehicleData.id } });
      if (duplicate) throw new Error(`Vehicle registration number ${vehicleData.registrationNumber} is already registered.`);
      vehicle = await Vehicle.findOneAndUpdate({ id: vehicleData.id }, vehicleData, { new: true });
    } else {
      const duplicate = await Vehicle.findOne({ registrationNumber: vehicleData.registrationNumber.toUpperCase() });
      if (duplicate) throw new Error(`Vehicle registration number ${vehicleData.registrationNumber} is already registered.`);
      const count = await Vehicle.countDocuments();
      vehicleData.id = "V" + String(count + 1).padStart(3, "0");
      vehicleData.registrationNumber = vehicleData.registrationNumber.toUpperCase();
      vehicle = new Vehicle(vehicleData);
      await vehicle.save();
    }
    await addLog(operator, role, "Save Vehicle", `Saved vehicle ${vehicle.registrationNumber}`);
    res.json(vehicle);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. DRIVER ENDPOINTS
app.get("/api/drivers", async (req, res) => {
  if (isMemoryMode) return res.json(memDrivers);
  try {
    const list = await Driver.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drivers", async (req, res) => {
  const driverData = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    validateDriverData(driverData);

    if (isMemoryMode) {
      if (driverData.id) {
        const idx = memDrivers.findIndex(d => d.id === driverData.id);
        memDrivers[idx] = { ...memDrivers[idx], ...driverData };
        res.json(memDrivers[idx]);
      } else {
        const duplicate = memDrivers.find(d => d.licenseNumber === driverData.licenseNumber.toUpperCase());
        if (duplicate) throw new Error(`License number is already registered.`);
        driverData.id = "D" + String(memDrivers.length + 1).padStart(3, "0");
        driverData.licenseNumber = driverData.licenseNumber.toUpperCase();
        memDrivers.push(driverData);
        res.json(driverData);
      }
      await addLog(operator, role, "Save Driver (Memory)", `Saved driver ${driverData.name}`);
      return;
    }

    let driver;
    if (driverData.id) {
      driver = await Driver.findOneAndUpdate({ id: driverData.id }, driverData, { new: true });
    } else {
      const duplicate = await Driver.findOne({ licenseNumber: driverData.licenseNumber.toUpperCase() });
      if (duplicate) throw new Error(`License number is already registered.`);
      const count = await Driver.countDocuments();
      driverData.id = "D" + String(count + 1).padStart(3, "0");
      driverData.licenseNumber = driverData.licenseNumber.toUpperCase();
      driver = new Driver(driverData);
      await driver.save();
    }
    await addLog(operator, role, "Save Driver", `Saved driver profile for ${driver.name}`);
    res.json(driver);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. DISPATCH & TRIP OPERATIONS
app.get("/api/trips", async (req, res) => {
  if (isMemoryMode) return res.json(memTrips);
  try {
    const list = await Trip.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DISPATCH & TRIP OPERATIONS
app.get("/api/trips", async (req, res) => {
  if (isMemoryMode) return res.json(memTrips);
  try {
    const list = await Trip.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Draft Trip
app.post("/api/trips", async (req, res) => {
  const { source, destination, vehicleId, driverId, cargoWeight, plannedDistance, estimatedDuration, deliverySchedule } = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let vehicle, driver;
    if (isMemoryMode) {
      vehicle = memVehicles.find(v => v.id === vehicleId);
      driver = memDrivers.find(d => d.id === driverId);
    } else {
      vehicle = await Vehicle.findOne({ id: vehicleId });
      driver = await Driver.findOne({ id: driverId });
    }

    if (!vehicle) throw new Error("Selected vehicle does not exist.");
    if (!driver) throw new Error("Selected driver does not exist.");
    if (cargoWeight > vehicle.maxLoad) throw new Error(`Cargo weight exceeds vehicle capacity (${vehicle.maxLoad} kg).`);

    let trip;
    if (isMemoryMode) {
      trip = {
        id: "T" + String(memTrips.length + 1).padStart(3, "0"),
        source,
        destination,
        vehicleId,
        driverId,
        cargoWeight: parseFloat(cargoWeight),
        plannedDistance: parseFloat(plannedDistance),
        estimatedDuration: parseFloat(estimatedDuration),
        deliverySchedule,
        status: "Draft",
        routeCoordinates: [],
        speed: 0,
        routeIndex: 0
      };
      memTrips.push(trip);
      await addLog(operator, role, "Trip Draft Created (Memory)", `Created draft trip ${trip.id}`);
      return res.json(trip);
    }

    const tCount = await Trip.countDocuments();
    trip = new Trip({
      id: "T" + String(tCount + 1).padStart(3, "0"),
      source,
      destination,
      vehicleId,
      driverId,
      cargoWeight: parseFloat(cargoWeight),
      plannedDistance: parseFloat(plannedDistance),
      estimatedDuration: parseFloat(estimatedDuration),
      deliverySchedule,
      status: "Draft"
    });
    await trip.save();
    await addLog(operator, role, "Trip Draft Created", `Created draft trip ${trip.id}`);
    res.json(trip);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dispatch Draft Trip (Transition status from Draft to Dispatched)
app.post("/api/trips/:id/dispatch", async (req, res) => {
  const { id } = req.params;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let trip, vehicle, driver;

    if (isMemoryMode) {
      trip = memTrips.find(t => t.id === id);
      if (!trip) throw new Error("Trip not found.");
      vehicle = memVehicles.find(v => v.id === trip.vehicleId);
      driver = memDrivers.find(d => d.id === trip.driverId);
    } else {
      trip = await Trip.findOne({ id });
      if (!trip) throw new Error("Trip not found.");
      vehicle = await Vehicle.findOne({ id: trip.vehicleId });
      driver = await Driver.findOne({ id: trip.driverId });
    }

    if (!vehicle) throw new Error("Vehicle associated with trip does not exist.");
    if (!driver) throw new Error("Driver associated with trip does not exist.");

    // Strict Business Rule Validations at dispatch time:
    if (vehicle.status === "In Shop") throw new Error(`Vehicle ${vehicle.registrationNumber} is In Shop and cannot be dispatched.`);
    if (vehicle.status === "Retired") throw new Error(`Vehicle ${vehicle.registrationNumber} is Retired.`);
    if (vehicle.status === "On Trip") throw new Error(`Vehicle ${vehicle.registrationNumber} is already engaged in an active trip.`);
    if (driver.status === "Suspended") throw new Error(`Driver ${driver.name} is Suspended.`);
    if (driver.status === "Off Duty") throw new Error(`Driver ${driver.name} is Off Duty.`);
    if (driver.status === "On Trip") throw new Error(`Driver ${driver.name} is already engaged in an active trip.`);
    if (driver.verificationStatus !== "Verified") throw new Error(`Driver ${driver.name} is not Verified.`);
    if (new Date(driver.licenseExpiry) < CURRENT_DATE) throw new Error("Driver license is expired.");
    if (trip.cargoWeight > vehicle.maxLoad) throw new Error(`Cargo weight exceeds vehicle capacity (${vehicle.maxLoad} kg).`);

    // Document validity validation checks:
    if (new Date(vehicle.insuranceExpiry) < CURRENT_DATE) throw new Error("Vehicle insurance certificate is expired.");
    if (new Date(vehicle.fitnessExpiry) < CURRENT_DATE) throw new Error("Vehicle fitness certificate is expired.");
    if (new Date(vehicle.permitExpiry) < CURRENT_DATE) throw new Error("Vehicle permit is expired.");

    // Generate simulated coordinates
    const startLat = 18.9486;
    const startLng = 72.8468;
    const endLat = 18.5204;
    const endLng = 73.8567;
    const steps = 30;
    const routeCoords = [];
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      routeCoords.push([
        startLat + (endLat - startLat) * ratio + (i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 0.015),
        startLng + (endLng - startLng) * ratio + (i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 0.015)
      ]);
    }

    trip.status = "Dispatched";
    trip.startTime = new Date().toISOString();
    trip.routeCoordinates = routeCoords;
    trip.speed = 52;
    trip.routeIndex = 0;

    vehicle.status = "On Trip";
    driver.status = "On Trip";

    if (!isMemoryMode) {
      await vehicle.save();
      await driver.save();
      await trip.save();
    }

    await addLog(operator, role, "Trip Dispatched", `Dispatched Trip ${trip.id} carrying ${trip.cargoWeight} kg.`);
    res.json(trip);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/trips/:id/complete", async (req, res) => {
  const { id } = req.params;
  const { endOdometer } = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let trip, vehicle, driver;

    if (isMemoryMode) {
      trip = memTrips.find(t => t.id === id);
      if (!trip) throw new Error("Trip not found.");
      vehicle = memVehicles.find(v => v.id === trip.vehicleId);
      driver = memDrivers.find(d => d.id === trip.driverId);

      trip.status = "Completed";
      trip.endTime = new Date().toISOString();
      trip.speed = 0;

      vehicle.status = "Available";
      driver.status = "Available";

      if (endOdometer && endOdometer > vehicle.odometer) {
        vehicle.odometer = endOdometer;
      } else {
        vehicle.odometer += trip.plannedDistance;
      }

      // Add revenue expense
      memExpenses.push({
        id: "E" + String(memExpenses.length + 1).padStart(3, "0") + "_" + Date.now(),
        vehicleId: vehicle.id,
        tripId: trip.id,
        type: "Income",
        amount: trip.plannedDistance * 30,
        date: new Date().toISOString().split("T")[0],
        description: `Revenue from Trip ${trip.id} completed.`
      });

      await addLog(operator, role, "Trip Completed (Memory)", `Completed trip ${trip.id}`);
      return res.json(trip);
    }

    trip = await Trip.findOne({ id });
    if (!trip) throw new Error("Trip not found.");
    vehicle = await Vehicle.findOne({ id: trip.vehicleId });
    driver = await Driver.findOne({ id: trip.driverId });

    trip.status = "Completed";
    trip.endTime = new Date().toISOString();
    trip.speed = 0;

    vehicle.status = "Available";
    driver.status = "Available";

    if (endOdometer && endOdometer > vehicle.odometer) {
      vehicle.odometer = endOdometer;
    } else {
      vehicle.odometer += trip.plannedDistance;
    }

    const revenue = trip.plannedDistance * 30;
    const eCount = await Expense.countDocuments();
    const incomeExpense = new Expense({
      id: "E" + String(eCount + 1).padStart(3, "0") + "_" + Date.now(),
      vehicleId: vehicle.id,
      tripId: trip.id,
      type: "Income",
      amount: revenue,
      date: new Date().toISOString().split("T")[0],
      description: `Revenue from Trip ${trip.id} completed.`
    });

    await incomeExpense.save();
    await vehicle.save();
    await driver.save();
    await trip.save();

    await addLog(operator, role, "Trip Completed", `Completed Trip ${trip.id}`);
    res.json(trip);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/trips/:id/cancel", async (req, res) => {
  const { id } = req.params;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let trip, vehicle, driver;

    if (isMemoryMode) {
      trip = memTrips.find(t => t.id === id);
      if (!trip) throw new Error("Trip not found.");
      vehicle = memVehicles.find(v => v.id === trip.vehicleId);
      driver = memDrivers.find(d => d.id === trip.driverId);

      trip.status = "Cancelled";
      trip.endTime = new Date().toISOString();
      trip.speed = 0;

      vehicle.status = "Available";
      driver.status = "Available";

      await addLog(operator, role, "Trip Cancelled (Memory)", `Cancelled active trip ${trip.id}`);
      return res.json(trip);
    }

    trip = await Trip.findOne({ id });
    if (!trip) throw new Error("Trip not found.");
    vehicle = await Vehicle.findOne({ id: trip.vehicleId });
    driver = await Driver.findOne({ id: trip.driverId });

    trip.status = "Cancelled";
    trip.endTime = new Date().toISOString();
    trip.speed = 0;

    vehicle.status = "Available";
    driver.status = "Available";

    await vehicle.save();
    await driver.save();
    await trip.save();

    await addLog(operator, role, "Trip Cancelled", `Cancelled active Trip ${trip.id}`);
    res.json(trip);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. MAINTENANCE ENDPOINTS
app.get("/api/maintenance", async (req, res) => {
  if (isMemoryMode) return res.json(memMaintenance);
  try {
    const list = await Maintenance.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/maintenance", async (req, res) => {
  const maintData = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let vehicle;
    if (isMemoryMode) {
      vehicle = memVehicles.find(v => v.id === maintData.vehicleId);
      if (!vehicle) throw new Error("Vehicle does not exist.");

      maintData.id = "M" + String(memMaintenance.length + 1).padStart(3, "0");
      maintData.status = "Active";

      vehicle.status = "In Shop";

      memMaintenance.push(maintData);

      // Log expense
      memExpenses.push({
        id: "E" + String(memExpenses.length + 1).padStart(3, "0") + "_" + Date.now(),
        vehicleId: vehicle.id,
        type: "Maintenance",
        amount: maintData.cost,
        date: maintData.scheduledDate,
        description: `Service Order M${maintData.id}: ${maintData.description}`
      });

      await addLog(operator, role, "Maintenance Scheduled (Memory)", `Scheduled service ${maintData.id} for ${vehicle.registrationNumber}`);
      return res.json(maintData);
    }

    vehicle = await Vehicle.findOne({ id: maintData.vehicleId });
    if (!vehicle) throw new Error("Vehicle does not exist.");

    const mCount = await Maintenance.countDocuments();
    maintData.id = "M" + String(mCount + 1).padStart(3, "0");
    maintData.status = "Active";

    const maint = new Maintenance(maintData);
    vehicle.status = "In Shop";

    const eCount = await Expense.countDocuments();
    const serviceCost = new Expense({
      id: "E" + String(eCount + 1).padStart(3, "0") + "_" + Date.now(),
      vehicleId: vehicle.id,
      type: "Maintenance",
      amount: maintData.cost,
      date: maintData.scheduledDate,
      description: `Service Order M${maintData.id}: ${maintData.description}`
    });

    await serviceCost.save();
    await vehicle.save();
    await maint.save();

    await addLog(operator, role, "Maintenance Scheduled", `Scheduled maintenance ${maint.id} for ${vehicle.registrationNumber}`);
    res.json(maint);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/maintenance/:id/complete", async (req, res) => {
  const { id } = req.params;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    let maint, vehicle;

    if (isMemoryMode) {
      maint = memMaintenance.find(m => m.id === id);
      if (!maint) throw new Error("Maintenance record not found.");

      vehicle = memVehicles.find(v => v.id === maint.vehicleId);

      maint.status = "Completed";
      maint.completionDate = new Date().toISOString().split("T")[0];

      if (vehicle && vehicle.status === "In Shop") {
        vehicle.status = "Available";
      }

      await addLog(operator, role, "Maintenance Completed (Memory)", `Completed service ${maint.id} for ${vehicle ? vehicle.registrationNumber : 'Unknown'}`);
      return res.json(maint);
    }

    maint = await Maintenance.findOne({ id });
    if (!maint) throw new Error("Maintenance record not found.");
    vehicle = await Vehicle.findOne({ id: maint.vehicleId });

    maint.status = "Completed";
    maint.completionDate = new Date().toISOString().split("T")[0];

    if (vehicle && vehicle.status === "In Shop") {
      vehicle.status = "Available";
      await vehicle.save();
    }

    await maint.save();
    await addLog(operator, role, "Maintenance Completed", `Completed service ${maint.id} for ${vehicle ? vehicle.registrationNumber : 'Unknown'}`);
    res.json(maint);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. EXPENSE ENDPOINTS
app.get("/api/expenses", async (req, res) => {
  if (isMemoryMode) return res.json(memExpenses);
  try {
    const list = await Expense.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  const expData = req.body;
  const operator = req.headers["operator-id"] || "SYSTEM";
  const role = req.headers["operator-role"] || "Admin";

  try {
    if (isMemoryMode) {
      expData.id = "E" + String(memExpenses.length + 1).padStart(3, "0") + "_" + Date.now();
      memExpenses.push(expData);

      if (expData.type === "Fuel" && expData.odometerReading) {
        const vehicle = memVehicles.find(v => v.id === expData.vehicleId);
        if (vehicle && expData.odometerReading > vehicle.odometer) {
          vehicle.odometer = expData.odometerReading;
        }
      }
      await addLog(operator, role, "Add Expense (Memory)", `Logged expense: ${expData.type} of ${expData.amount}`);
      return res.json(expData);
    }

    const count = await Expense.countDocuments();
    expData.id = "E" + String(count + 1).padStart(3, "0") + "_" + Date.now();
    const expense = new Expense(expData);
    await expense.save();

    if (expense.type === "Fuel" && expense.odometerReading) {
      const vehicle = await Vehicle.findOne({ id: expense.vehicleId });
      if (vehicle && expense.odometerReading > vehicle.odometer) {
        vehicle.odometer = expense.odometerReading;
        await vehicle.save();
      }
    }

    await addLog(operator, role, "Add Expense", `Logged operational expense: ${expense.type} of ${expense.amount} INR`);
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. SYSTEM LOGS
app.get("/api/logs", async (req, res) => {
  if (isMemoryMode) return res.json(memLogs);
  try {
    const list = await AuditLog.find().sort({ timestamp: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logs/client-error", (req, res) => {
  console.error("🔴 CLIENT SIDE ERROR:", req.body.message);
  if (req.body.stack) {
    console.error(req.body.stack);
  }
  res.sendStatus(200);
});

// Serve frontend assets statically
app.use(express.static(__dirname));

// Default route fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ----------------------------------------------------
// SYSTEM SEED & LAUNCH
// ----------------------------------------------------

async function seedData() {
  try {
    const usersCount = await User.countDocuments();
    if (usersCount > 0) return;

    console.log("Seeding default MongoDB datasets...");

    // Seeding default users
    await User.insertMany(memUsers);

    // Seeding vehicles
    await Vehicle.insertMany(memVehicles);

    // Seeding drivers
    await Driver.insertMany(memDrivers);

    // Seeding active trips
    await Trip.insertMany(memTrips);

    // Seeding maintenance schedules
    await Maintenance.insertMany(memMaintenance);

    // Seeding expenses
    await Expense.insertMany(memExpenses);

    console.log("MongoDB Atlas databases seeded successfully.");
  } catch (err) {
    console.error("DB Seed failure:", err.message);
  }
}

// Connect to MongoDB Atlas / Local
const connectOptions = {
  serverSelectionTimeoutMS: 5000 // Timeout in 5 seconds
};

console.log("Connecting to database:", MONGODB_URI);
mongoose.connect(MONGODB_URI, connectOptions)
  .then(async () => {
    console.log("Connected to MongoDB Atlas successfully.");
    await seedData();
    startServer();
  })
  .catch(async (err) => {
    console.warn("Database connection failed. Falling back to public MongoDB Atlas sandbox...");
    const FALLBACK_URI = "mongodb+srv://transitops_user:TransitOps123@cluster0.pdtc0.mongodb.net/transitops?retryWrites=true&w=majority";
    try {
      await mongoose.connect(FALLBACK_URI, connectOptions);
      console.log("Connected to public MongoDB Atlas sandbox successfully.");
      await seedData();
      startServer();
    } catch (fallbackErr) {
      console.warn("All database connections failed. Transitioning to TransitOps offline Memory Mode...");
      isMemoryMode = true;
      startServer();
    }
  });

function startServer() {
  app.listen(PORT, () => {
    console.log(`TransitOps Full-Stack Server active on http://localhost:${PORT}`);
    console.log(`Operational Mode: ${isMemoryMode ? '⚠️ OFFLINE MEMORY FALLBACK' : '🟢 ONLINE MONGODB ATLAS'}`);
  });
}
