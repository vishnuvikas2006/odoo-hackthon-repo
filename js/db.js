// TransitOps - Client Database Manager (API-First with LocalStorage Fallback)
// Date Reference Context: July 12, 2026

const CURRENT_DATE = new Date("2026-07-12T09:45:00");
const API_BASE = "/api";

class TransitOpsDB {
  constructor() {
    this.isOffline = true;
    this.initLocalStorageFallback();
    this.checkApiStatus();
  }

  // Initialize browser LocalStorage variables as backup
  initLocalStorageFallback() {
    if (!localStorage.getItem("transitops_initialized")) {
      const DEFAULT_USERS = [
        { id: "U001", username: "admin", name: "Sarah Jenkins", role: "Admin", email: "sarah.j@transitops.com", password: "admin123" },
        { id: "U002", username: "fleet_mgr", name: "David Vance", role: "Fleet Manager", email: "david.v@transitops.com", password: "password123" },
        { id: "U003", username: "dispatch_mgr", name: "Michael Chang", role: "Dispatch Manager", email: "michael.c@transitops.com", password: "password123" },
        { id: "U004", username: "driver_johnd", name: "John Doe", role: "Driver", email: "john.doe@transitops.com", password: "password123", driverId: "D001" },
        { id: "U005", username: "safety_off", name: "Elena Rostova", role: "Safety Officer", email: "elena.r@transitops.com", password: "password123" },
        { id: "U006", username: "fin_analyst", name: "Marcus Brody", role: "Financial Analyst", email: "marcus.b@transitops.com", password: "password123" }
      ];

      const DEFAULT_VEHICLES = [
        { id: "V001", registrationNumber: "MH-12-QW-8842", model: "Tata Prima 4925.S", type: "Truck", maxLoad: 12000, odometer: 145200, acquisitionCost: 4500000, status: "Available", insuranceExpiry: "2027-03-15", fitnessExpiry: "2026-11-20", permitExpiry: "2027-01-10", region: "Pune", specifications: "250 HP Engine" },
        { id: "V002", registrationNumber: "MH-14-EU-4521", model: "Mahindra Bolero Pik-Up", type: "Van", maxLoad: 1500, odometer: 64100, acquisitionCost: 950000, status: "Available", insuranceExpiry: "2027-08-10", fitnessExpiry: "2027-05-30", permitExpiry: "2027-12-05", region: "Pune", specifications: "Flatbed carrier" },
        { id: "V003", registrationNumber: "DL-1C-AA-9988", model: "BharatBenz 1917R", type: "Truck", maxLoad: 8000, odometer: 89300, acquisitionCost: 3200000, status: "In Shop", insuranceExpiry: "2027-05-02", fitnessExpiry: "2027-04-15", permitExpiry: "2027-06-25", region: "Delhi", specifications: "170 HP container" },
        { id: "V004", registrationNumber: "KA-03-MM-7112", model: "Ashok Leyland Dost+", type: "Van", maxLoad: 1250, odometer: 112000, acquisitionCost: 800000, status: "Retired", insuranceExpiry: "2025-12-31", fitnessExpiry: "2025-12-31", permitExpiry: "2025-12-31", region: "Bangalore", specifications: "Light carrier" },
        { id: "V005", registrationNumber: "MH-43-BB-1122", model: "Eicher Pro 3015", type: "Truck", maxLoad: 5500, odometer: 42100, acquisitionCost: 2100000, status: "On Trip", insuranceExpiry: "2027-01-20", fitnessExpiry: "2026-10-15", permitExpiry: "2027-02-18", region: "Mumbai", specifications: "160 HP Dropside" },
        { id: "V006", registrationNumber: "MH-12-KA-5566", model: "Toyota Innova Crysta", type: "Cab", maxLoad: 600, odometer: 32400, acquisitionCost: 2200000, status: "Available", insuranceExpiry: "2027-04-20", fitnessExpiry: "2027-04-15", permitExpiry: "2027-09-10", region: "Pune", specifications: "Passenger Cab" },
        { id: "V007", registrationNumber: "MH-12-RE-9900", model: "Bajaj RE Compact", type: "Auto", maxLoad: 350, odometer: 18100, acquisitionCost: 240000, status: "Available", insuranceExpiry: "2027-06-15", fitnessExpiry: "2027-05-10", permitExpiry: "2027-08-30", region: "Pune", specifications: "Passenger Auto" }
      ];

      const DEFAULT_DRIVERS = [
        { id: "D001", name: "John Doe", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop", licenseNumber: "DL-1420180099411", licenseCategory: "Heavy Transport", licenseExpiry: "2028-09-12", governmentId: "Aadhaar: 4421-9980-1234", emergencyContact: "Jane Doe - +91 98765 43210", contactNumber: "+91 98765 00112", safetyScore: 94, experience: 8, verificationStatus: "Verified", status: "Available" },
        { id: "D002", name: "Rajesh Kumar", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop", licenseNumber: "DL-1220159982451", licenseCategory: "Heavy Transport", licenseExpiry: "2026-06-30", governmentId: "Aadhaar: 8872-1142-9900", emergencyContact: "Amit Kumar - +91 99112 23344", contactNumber: "+91 99112 23344", safetyScore: 88, experience: 11, verificationStatus: "Verified", status: "Available" },
        { id: "D003", name: "Vikram Singh", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop", licenseNumber: "DL-1920204481011", licenseCategory: "Light Vehicle", licenseExpiry: "2029-01-15", governmentId: "Aadhaar: 3312-5566-7788", emergencyContact: "Kiran Singh - +91 98112 88442", contactNumber: "+91 98112 88442", safetyScore: 97, experience: 6, verificationStatus: "Pending", status: "Available" }
      ];

      const DEFAULT_TRIPS = [
        { id: "T001", source: "Mumbai Port Trust", destination: "Pune Logistics Hub", vehicleId: "V005", driverId: "D001", cargoWeight: 4500, plannedDistance: 150, estimatedDuration: 4, deliverySchedule: "2026-07-12T14:30:00", status: "Dispatched", startTime: "2026-07-12T08:00:00", routeIndex: 20, speed: 55, routeCoordinates: [[18.9486, 72.8468], [18.5204, 73.8567]] }
      ];

      localStorage.setItem("transitops_users", JSON.stringify(DEFAULT_USERS));
      localStorage.setItem("transitops_vehicles", JSON.stringify(DEFAULT_VEHICLES));
      localStorage.setItem("transitops_drivers", JSON.stringify(DEFAULT_DRIVERS));
      localStorage.setItem("transitops_trips", JSON.stringify(DEFAULT_TRIPS));
      localStorage.setItem("transitops_maintenance", JSON.stringify([]));
      localStorage.setItem("transitops_expenses", JSON.stringify([]));
      localStorage.setItem("transitops_audit_logs", JSON.stringify([]));
      localStorage.setItem("transitops_initialized", "true");
    }
  }

  // Check if server is running
  async checkApiStatus() {
    try {
      const res = await fetch(`${API_BASE}/vehicles`, { method: "GET" });
      if (res.ok) {
        this.isOffline = false;
        console.log("TransitOps API Server is online. Using MongoDB Atlas registry.");
      }
    } catch (err) {
      this.isOffline = true;
      console.warn("TransitOps API Server is offline. Running in Local Storage Fallback Mode.");
    }
  }

  // Get current logged-in user profile
  getCurrentUser() {
    try {
      const user = localStorage.getItem("transitops_current_user");
      return user ? JSON.parse(user) : null;
    } catch (err) {
      console.error("Failed to parse current user from localStorage:", err);
      localStorage.removeItem("transitops_current_user");
      return null;
    }
  }

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem("transitops_current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("transitops_current_user");
    }
  }

  async login(email, password) {
    if (this.isOffline) {
      const users = this.getLocalData("users");
      const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!matched) throw new Error("Invalid email or password.");
      return { status: "success", user: matched };
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Authentication failed.");
    return result;
  }

  async getUsers() {
    if (this.isOffline) {
      return this.getLocalData("users");
    }
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: this.getApiHeaders()
      });
      return await res.json();
    } catch (err) {
      return this.getLocalData("users");
    }
  }

  async saveUser(user) {
    if (this.isOffline) {
      const users = this.getLocalData("users");
      const index = users.findIndex(u => u.id === user.id);
      
      const duplicate = users.find(u => u.email.toLowerCase() === user.email.toLowerCase() && u.id !== user.id);
      if (duplicate) throw new Error(`Email address ${user.email} is already registered.`);

      if (index >= 0) {
        users[index] = { ...users[index], ...user };
      } else {
        user.id = "U" + String(users.length + 1).padStart(3, "0");
        users.push(user);
      }
      this.saveLocalData("users", users);
      return user;
    }

    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(user)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to save operator.");
    return result;
  }

  async deleteUser(id) {
    if (this.isOffline) {
      if (id === "U001") throw new Error("Primary system administrator account cannot be deleted.");
      const users = this.getLocalData("users");
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) throw new Error("User not found.");
      users.splice(idx, 1);
      this.saveLocalData("users", users);
      return { status: "success" };
    }

    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: this.getApiHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to delete operator.");
    return result;
  }

  // Generic helper for API request headers
  getApiHeaders() {
    const user = this.getCurrentUser();
    return {
      "Content-Type": "application/json",
      "operator-id": user ? user.id : "SYSTEM",
      "operator-role": user ? user.role : "Admin"
    };
  }

  // Local storage CRUD helpers
  getLocalData(key) {
    return JSON.parse(localStorage.getItem(`transitops_${key}`)) || [];
  }

  saveLocalData(key, data) {
    localStorage.setItem(`transitops_${key}`, JSON.stringify(data));
  }

  // VEHICLE OPERATIONS
  async getVehicles() {
    if (this.isOffline) {
      return this.getLocalData("vehicles");
    }
    try {
      const res = await fetch(`${API_BASE}/vehicles`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("vehicles");
    }
  }

  async getVehicleById(id) {
    const list = await this.getVehicles();
    return list.find(v => v.id === id);
  }

  async saveVehicle(vehicle) {
    if (this.isOffline) {
      const vehicles = this.getLocalData("vehicles");
      const index = vehicles.findIndex(v => v.id === vehicle.id);
      
      // Client-side unique check for offline fallback
      const duplicate = vehicles.find(v => v.registrationNumber.toUpperCase() === vehicle.registrationNumber.toUpperCase() && v.id !== vehicle.id);
      if (duplicate) throw new Error(`Vehicle registration number ${vehicle.registrationNumber} is already registered.`);

      if (index >= 0) {
        vehicles[index] = { ...vehicles[index], ...vehicle };
      } else {
        vehicle.id = "V" + String(vehicles.length + 1).padStart(3, "0");
        vehicle.registrationNumber = vehicle.registrationNumber.toUpperCase();
        vehicle.status = "Available";
        vehicles.push(vehicle);
      }
      this.saveLocalData("vehicles", vehicles);
      return vehicle;
    }

    const res = await fetch(`${API_BASE}/vehicles`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(vehicle)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to save vehicle registry.");
    return result;
  }

  // DRIVER OPERATIONS
  async getDrivers() {
    if (this.isOffline) {
      return this.getLocalData("drivers");
    }
    try {
      const res = await fetch(`${API_BASE}/drivers`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("drivers");
    }
  }

  async getDriverById(id) {
    const list = await this.getDrivers();
    return list.find(d => d.id === id);
  }

  async saveDriver(driver) {
    if (this.isOffline) {
      const drivers = this.getLocalData("drivers");
      const index = drivers.findIndex(d => d.id === driver.id);
      
      const duplicate = drivers.find(d => d.licenseNumber.toUpperCase() === driver.licenseNumber.toUpperCase() && d.id !== driver.id);
      if (duplicate) throw new Error(`Driving license number ${driver.licenseNumber} is already registered.`);

      if (index >= 0) {
        drivers[index] = driver;
      } else {
        driver.id = "D" + String(drivers.length + 1).padStart(3, "0");
        driver.licenseNumber = driver.licenseNumber.toUpperCase();
        drivers.push(driver);
      }
      this.saveLocalData("drivers", drivers);
      return driver;
    }

    const res = await fetch(`${API_BASE}/drivers`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(driver)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to onboard driver.");
    return result;
  }

  // TRIP OPERATIONS
  async getTrips() {
    if (this.isOffline) {
      return this.getLocalData("trips");
    }
    try {
      const res = await fetch(`${API_BASE}/trips`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("trips");
    }
  }

  async getTripById(id) {
    const list = await this.getTrips();
    return list.find(t => t.id === id);
  }

  async createTrip(tripData) {
    if (this.isOffline) {
      const vehicle = await this.getVehicleById(tripData.vehicleId);
      const driver = await this.getDriverById(tripData.driverId);

      if (!vehicle || !driver) throw new Error("Selected vehicle or driver does not exist.");
      if (tripData.cargoWeight > vehicle.maxLoad) throw new Error(`Cargo exceeds vehicle maximum capacity (${vehicle.maxLoad} kg).`);

      const trips = this.getLocalData("trips");
      const newTrip = {
        id: "T" + String(trips.length + 1).padStart(3, "0"),
        source: tripData.source,
        destination: tripData.destination,
        vehicleId: tripData.vehicleId,
        driverId: tripData.driverId,
        cargoWeight: parseFloat(tripData.cargoWeight),
        plannedDistance: parseFloat(tripData.plannedDistance),
        estimatedDuration: parseFloat(tripData.estimatedDuration),
        deliverySchedule: tripData.deliverySchedule,
        status: "Draft",
        routeIndex: 0,
        speed: 0,
        routeCoordinates: []
      };

      trips.push(newTrip);
      this.saveLocalData("trips", trips);
      return newTrip;
    }

    const res = await fetch(`${API_BASE}/trips`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(tripData)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to create trip.");
    return result;
  }

  async dispatchTrip(tripId) {
    if (this.isOffline) {
      const trips = this.getLocalData("trips");
      const trip = trips.find(t => t.id === tripId);
      if (!trip) throw new Error("Trip not found.");

      const vehicle = await this.getVehicleById(trip.vehicleId);
      const driver = await this.getDriverById(trip.driverId);

      if (!vehicle || !driver) throw new Error("Vehicle or driver associated with trip does not exist.");
      if (vehicle.status !== "Available") throw new Error(`Vehicle ${vehicle.registrationNumber} is not Available (Status: ${vehicle.status})`);
      if (driver.status !== "Available") throw new Error(`Driver ${driver.name} is not Available (Status: ${driver.status})`);
      if (driver.verificationStatus !== "Verified") throw new Error(`Driver ${driver.name} is not Verified.`);
      
      const CURRENT_DATE = new Date();
      if (new Date(driver.licenseExpiry) < CURRENT_DATE) throw new Error("Driver license is expired.");
      if (new Date(vehicle.insuranceExpiry) < CURRENT_DATE) throw new Error("Vehicle insurance is expired.");
      if (new Date(vehicle.fitnessExpiry) < CURRENT_DATE) throw new Error("Vehicle fitness certificate is expired.");
      if (new Date(vehicle.permitExpiry) < CURRENT_DATE) throw new Error("Vehicle permit is expired.");

      trip.status = "Dispatched";
      trip.startTime = new Date().toISOString();
      trip.speed = 52;
      trip.routeCoordinates = [[18.9486, 72.8468], [18.5204, 73.8567]];

      vehicle.status = "On Trip";
      driver.status = "On Trip";

      await this.saveVehicle(vehicle);
      await this.saveDriver(driver);
      this.saveLocalData("trips", trips);
      return trip;
    }

    const res = await fetch(`${API_BASE}/trips/${tripId}/dispatch`, {
      method: "POST",
      headers: this.getApiHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to dispatch trip.");
    return result;
  }

  async completeTrip(tripId, endOdometer) {
    if (this.isOffline) {
      const trips = this.getLocalData("trips");
      const trip = trips.find(t => t.id === tripId);
      if (!trip) throw new Error("Trip not found.");

      const vehicle = await this.getVehicleById(trip.vehicleId);
      const driver = await this.getDriverById(trip.driverId);

      trip.status = "Completed";
      trip.endTime = new Date().toISOString();

      vehicle.status = "Available";
      driver.status = "Available";
      if (endOdometer) vehicle.odometer = parseFloat(endOdometer);

      await this.saveVehicle(vehicle);
      await this.saveDriver(driver);
      this.saveLocalData("trips", trips);

      // Log income
      const expenses = this.getLocalData("expenses");
      expenses.push({
        id: "E" + String(expenses.length + 1).padStart(3, "0") + "_" + Date.now(),
        vehicleId: vehicle.id,
        tripId: trip.id,
        type: "Income",
        amount: trip.plannedDistance * 30,
        date: new Date().toISOString().split("T")[0],
        description: `Revenue from Trip ${trip.id}`
      });
      this.saveLocalData("expenses", expenses);

      return trip;
    }

    const res = await fetch(`${API_BASE}/trips/${tripId}/complete`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify({ endOdometer })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to complete trip.");
    return result;
  }

  async cancelTrip(tripId) {
    if (this.isOffline) {
      const trips = this.getLocalData("trips");
      const trip = trips.find(t => t.id === tripId);
      if (!trip) throw new Error("Trip not found.");

      const vehicle = await this.getVehicleById(trip.vehicleId);
      const driver = await this.getDriverById(trip.driverId);

      trip.status = "Cancelled";
      trip.endTime = new Date().toISOString();

      vehicle.status = "Available";
      driver.status = "Available";

      await this.saveVehicle(vehicle);
      await this.saveDriver(driver);
      this.saveLocalData("trips", trips);
      return trip;
    }

    const res = await fetch(`${API_BASE}/trips/${tripId}/cancel`, {
      method: "POST",
      headers: this.getApiHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to cancel trip.");
    return result;
  }

  // MAINTENANCE OPERATIONS
  async getMaintenance() {
    if (this.isOffline) {
      return this.getLocalData("maintenance");
    }
    try {
      const res = await fetch(`${API_BASE}/maintenance`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("maintenance");
    }
  }

  async scheduleMaintenance(record) {
    if (this.isOffline) {
      const vehicle = await this.getVehicleById(record.vehicleId);
      if (!vehicle) throw new Error("Vehicle does not exist.");

      const list = this.getLocalData("maintenance");
      record.id = "M" + String(list.length + 1).padStart(3, "0");
      record.status = "Active";

      vehicle.status = "In Shop";
      await this.saveVehicle(vehicle);

      list.push(record);
      this.saveLocalData("maintenance", list);

      // Auto expense
      const expenses = this.getLocalData("expenses");
      expenses.push({
        id: "E" + String(expenses.length + 1).padStart(3, "0") + "_" + Date.now(),
        vehicleId: vehicle.id,
        type: "Maintenance",
        amount: record.cost,
        date: record.scheduledDate,
        description: `Service Order M${record.id}`
      });
      this.saveLocalData("expenses", expenses);

      return record;
    }

    const res = await fetch(`${API_BASE}/maintenance`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(record)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to schedule maintenance.");
    return result;
  }

  async completeMaintenance(maintId) {
    if (this.isOffline) {
      const list = this.getLocalData("maintenance");
      const record = list.find(m => m.id === maintId);
      if (!record) throw new Error("Maintenance record not found.");

      record.status = "Completed";
      record.completionDate = new Date().toISOString().split("T")[0];

      const vehicle = await this.getVehicleById(record.vehicleId);
      if (vehicle && vehicle.status === "In Shop") {
        vehicle.status = "Available";
        await this.saveVehicle(vehicle);
      }

      this.saveLocalData("maintenance", list);
      return record;
    }

    const res = await fetch(`${API_BASE}/maintenance/${maintId}/complete`, {
      method: "POST",
      headers: this.getApiHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to complete maintenance.");
    return result;
  }

  // EXPENSE OPERATIONS
  async getExpenses() {
    if (this.isOffline) {
      return this.getLocalData("expenses");
    }
    try {
      const res = await fetch(`${API_BASE}/expenses`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("expenses");
    }
  }

  async addExpense(expense) {
    if (this.isOffline) {
      const expenses = this.getLocalData("expenses");
      expense.id = "E" + String(expenses.length + 1).padStart(3, "0") + "_" + Date.now();
      expenses.push(expense);
      this.saveLocalData("expenses", expenses);

      if (expense.type === "Fuel" && expense.odometerReading) {
        const vehicle = await this.getVehicleById(expense.vehicleId);
        if (vehicle && expense.odometerReading > vehicle.odometer) {
          vehicle.odometer = parseFloat(expense.odometerReading);
          await this.saveVehicle(vehicle);
        }
      }
      return expense;
    }

    const res = await fetch(`${API_BASE}/expenses`, {
      method: "POST",
      headers: this.getApiHeaders(),
      body: JSON.stringify(expense)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to log expense.");
    return result;
  }

  // SYSTEM LOGS
  async getLogs() {
    if (this.isOffline) {
      return this.getLocalData("audit_logs");
    }
    try {
      const res = await fetch(`${API_BASE}/logs`);
      return await res.json();
    } catch (err) {
      return this.getLocalData("audit_logs");
    }
  }
}

// Bind instance to global scope
window.db = new TransitOpsDB();
window.CURRENT_DATE = CURRENT_DATE;
