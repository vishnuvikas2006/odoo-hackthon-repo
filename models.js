const mongoose = require('mongoose');
const { Schema } = mongoose;

/* ============================= USER ============================= */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['FleetManager', 'Driver', 'SafetyOfficer', 'FinancialAnalyst'] }
}, { timestamps: true });

/* ============================= VEHICLE ============================= */
const vehicleSchema = new Schema({
  regNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['Van', 'Truck', 'Bike', 'Trailer'] },
  maxLoadCapacity: { type: Number, required: true, min: 1 },
  odometer: { type: Number, default: 0, min: 0 },
  odometerAtLastService: { type: Number, default: 0, min: 0 },
  acquisitionCost: { type: Number, required: true, min: 0 },
  region: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Available', 'On Trip', 'In Shop', 'Retired'], default: 'Available' }
}, { timestamps: true });

/* ============================= DRIVER ============================= */
const driverSchema = new Schema({
  name: { type: String, required: true, trim: true },
  licenseNumber: { type: String, required: true, unique: true, trim: true },
  licenseCategory: { type: String, required: true, trim: true },
  licenseExpiry: { type: Date, required: true },
  contact: { type: String, required: true, trim: true },
  safetyScore: { type: Number, default: 100, min: 0, max: 100 },
  status: { type: String, enum: ['Available', 'On Trip', 'Off Duty', 'Suspended'], default: 'Available' }
}, { timestamps: true });

/* ============================= TRIP ============================= */
const tripSchema = new Schema({
  source: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  cargoWeight: { type: Number, required: true, min: 0 },
  plannedDistance: { type: Number, required: true, min: 0 },
  actualDistance: { type: Number, default: 0 },
  fuelConsumed: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Dispatched', 'Completed', 'Cancelled'], default: 'Draft' },
  dispatchedAt: Date,
  completedAt: Date
}, { timestamps: true });

/* ============================= MAINTENANCE ============================= */
const maintenanceSchema = new Schema({
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  description: { type: String, required: true, trim: true },
  cost: { type: Number, required: true, min: 0 },
  odometerAtService: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
  date: { type: Date, default: Date.now },
  closedAt: Date
}, { timestamps: true });

/* ============================= FUEL LOG ============================= */
const fuelLogSchema = new Schema({
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  liters: { type: Number, required: true, min: 0 },
  cost: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

/* ============================= EXPENSE ============================= */
const expenseSchema = new Schema({
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  type: { type: String, required: true, enum: ['Toll', 'Fine', 'Parking', 'Other'] },
  cost: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

/* ============================= BLOCKCHAIN BLOCK ============================= */
const blockSchema = new Schema({
  index: { type: Number, required: true, unique: true },
  timestamp: { type: Date, required: true },
  eventType: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  actor: { type: String, required: true },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Vehicle: mongoose.model('Vehicle', vehicleSchema),
  Driver: mongoose.model('Driver', driverSchema),
  Trip: mongoose.model('Trip', tripSchema),
  Maintenance: mongoose.model('Maintenance', maintenanceSchema),
  FuelLog: mongoose.model('FuelLog', fuelLogSchema),
  Expense: mongoose.model('Expense', expenseSchema),
  Block: mongoose.model('Block', blockSchema)
};
