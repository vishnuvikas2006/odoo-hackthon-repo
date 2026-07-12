// TransitOps - GPS Live Tracking Map & Simulation Engine (Leaflet.js wrapper)

let mapInstance = null;
let vehicleMarkers = {}; // Map of tripId -> Leaflet marker
let geofenceCircles = []; // List of geofence overlays
let simulationInterval = null;

// Mumbai-Pune Hub Coordinates
const HUB_COORDINATES = {
  mumbaiPort: [18.9486, 72.8468],
  puneHub: [18.5204, 73.8567],
  nashikWarehouse: [19.9975, 73.7898],
  lonavalaCheckpost: [18.7500, 73.4000] // Centered checkpost for geofence
};

// Initialize the tracking map
function initTrackingMap() {
  const mapElement = document.getElementById("tracking-map");
  if (!mapElement) return;

  // Re-create map container if it already exists to avoid Leaflet double initialization errors
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  // Initialize map centered between Mumbai and Pune
  mapInstance = L.map("tracking-map").setView([18.75, 73.25], 9);

  // Add highly readable OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mapInstance);

  // Draw geofence circle around Lonavala checkpost (radius 8km)
  const lonavalaGeofence = L.circle(HUB_COORDINATES.lonavalaCheckpost, {
    color: "#f59e0b", // Yellow/Orange
    fillColor: "#f59e0b",
    fillOpacity: 0.15,
    radius: 8000 // 8000 meters
  }).addTo(mapInstance);

  lonavalaGeofence.bindPopup("<b>Geofenced Transit Corridor</b><br>Speed Limit: 50 km/h<br>Lonavala Pass");
  geofenceCircles.push(lonavalaGeofence);

  // Load and render active trips
  updateMapTrips();

  // Start real-time movement simulation if not running
  if (!simulationInterval) {
    startGpsSimulation();
  }
}

// Render/Update active markers and paths
async function updateMapTrips() {
  if (!mapInstance) return;

  const db = window.db;
  if (!db) return;

  const trips = (await db.getTrips()).filter(t => t.status === "On Trip" || t.status === "Dispatched");
  const activeTripIds = trips.map(t => t.id);

  // 1. Remove markers of trips that are no longer active (completed/cancelled)
  Object.keys(vehicleMarkers).forEach(tripId => {
    if (!activeTripIds.includes(tripId)) {
      mapInstance.removeLayer(vehicleMarkers[tripId].marker);
      if (vehicleMarkers[tripId].polyline) {
        mapInstance.removeLayer(vehicleMarkers[tripId].polyline);
      }
      delete vehicleMarkers[tripId];
    }
  });

  // 2. Render current active trips
  for (const trip of trips) {
    const vehicle = await db.getVehicleById(trip.vehicleId);
    const driver = await db.getDriverById(trip.driverId);
    if (!vehicle || !driver) continue;

    // Get current position coordinates
    const route = trip.routeCoordinates || [];
    if (route.length === 0) continue;

    const currentIndex = trip.routeIndex || 0;
    const currentCoords = route[currentIndex] || route[0];

    // If marker exists, update position. Otherwise, create it.
    if (vehicleMarkers[trip.id]) {
      vehicleMarkers[trip.id].marker.setLatLng(currentCoords);
      vehicleMarkers[trip.id].marker.getPopup().setContent(generatePopupContent(trip, vehicle, driver, currentCoords));
    } else {
      // Draw entire planned route polyline
      const polyline = L.polyline(route, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.6,
        dashArray: "5, 10"
      }).addTo(mapInstance);

      // Create Custom SVG Icon for Vehicle
      const color = trip.routeDeviation ? "#ef4444" : "#10b981";
      const vehicleIcon = L.divIcon({
        className: "custom-vehicle-icon",
        html: `
          <div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${vehicle.type === "Truck" 
                ? '<rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'
                : '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle>'
              }
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker(currentCoords, { icon: vehicleIcon }).addTo(mapInstance);
      marker.bindPopup(generatePopupContent(trip, vehicle, driver, currentCoords));

      vehicleMarkers[trip.id] = { marker, polyline };
    }
  }
}

// Generate rich popup details for the map
function generatePopupContent(trip, vehicle, driver, coords) {
  const deviationBadge = trip.routeDeviation 
    ? '<span style="background-color:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px;">DEVIATION DETECTED</span>'
    : '<span style="background-color:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px;">ON ROUTE</span>';

  const speedLimit = 50;
  const speedBadge = trip.speed > speedLimit
    ? `<span style="background-color:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px;">OVERSPEED (${trip.speed} km/h)</span>`
    : `<span style="background-color:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px;">${trip.speed} km/h</span>`;

  return `
    <div style="font-family: Inter, sans-serif; width: 220px; font-size:12px;">
      <h4 style="margin: 0 0 4px 0; color: #1e3a8a; display:flex; align-items:center; justify-content:space-between;">
        <span>Trip: <b>${trip.id}</b></span>
        ${deviationBadge}
      </h4>
      <p style="margin: 0 0 6px 0; color: #6b7280; font-size:11px;">Vehicle: <b>${vehicle.registrationNumber}</b> (${vehicle.model})</p>
      <hr style="border-top:1px solid #e5e7eb; margin: 6px 0;">
      <div style="margin-bottom: 4px;">Driver: <b>${driver.name}</b> (Safety Score: ${driver.safetyScore}%)</div>
      <div style="margin-bottom: 4px;">Cargo: <b>${trip.cargoWeight} kg</b> / Max: ${vehicle.maxLoad} kg</div>
      <div style="margin-bottom: 4px;">Route: <b>${trip.source}</b> &rarr; <b>${trip.destination}</b></div>
      <div style="margin-bottom: 6px;">Status: ${speedBadge}</div>
      <div style="display:flex; justify-content:space-between; margin-top:8px;">
        <button onclick="triggerEmergencyAlert('${trip.id}')" style="background-color:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer; width:100%;">ALERT PANIC BUTTON</button>
      </div>
    </div>
  `;
}

// Start simulating real-time GPS updates
function startGpsSimulation() {
  simulationInterval = setInterval(async () => {
    const db = window.db;
    if (!db) return;

    let trips = await db.getTrips();
    let updated = false;

    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      if (trip.status !== "On Trip" && trip.status !== "Dispatched") continue;

      const route = trip.routeCoordinates || [];
      if (route.length === 0) continue;

      let currentIndex = trip.routeIndex || 0;
      currentIndex += 1;

      // Check if trip is finished
      if (currentIndex >= route.length) {
        try {
          const v = await db.getVehicleById(trip.vehicleId);
          await db.completeTrip(trip.id, v.odometer + trip.plannedDistance);
          updated = true;

          showToast(`Trip ${trip.id} completed. Vehicle returned to Available status.`);
          if (window.renderActiveView) window.renderActiveView();
        } catch (err) {
          console.error(err);
        }
        continue;
      }

      trip.routeIndex = currentIndex;
      updated = true;

      // Simulate dynamic parameters
      trip.speed = 40 + Math.floor(Math.random() * 25);

      const currentPos = route[currentIndex];
      const distToLonavala = getCoordinateDistance(currentPos, HUB_COORDINATES.lonavalaCheckpost);
      
      if (distToLonavala <= 8) {
        if (!trip.geofenceAlerts.includes("Lonavala Zone Entered")) {
          trip.geofenceAlerts.push("Lonavala Zone Entered");
          const v = await db.getVehicleById(trip.vehicleId);
          showToast(`[Geofence] Vehicle ${v.registrationNumber} entered Lonavala Corridor.`);
          await db.addLog("SYSTEM", "AI Geofencer", "Geofence Entry", `Vehicle for Trip ${trip.id} entered Lonavala check corridor.`);
        }
        if (trip.speed > 50) {
          trip.speed = 58;
        }
      }

      if (Math.random() < 0.03 && !trip.routeDeviation) {
        trip.routeDeviation = true;
        showToast(`[Alert] Critical route deviation detected for Trip ${trip.id}!`, "warning");
        await db.addLog("SYSTEM", "AI Dispatcher", "Route Deviation", `Trip ${trip.id} is off-route. Contacting driver.`);
      }
    }

    if (updated) {
      db.saveLocalData("trips", trips);
      await updateMapTrips();
      if (window.renderActiveView) window.renderActiveView();
    }
  }, 3500);
}

// Calculate distance between two coordinates in km (Haversine formula)
function getCoordinateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Manual trigger for emergency panic button
async function triggerEmergencyAlert(tripId) {
  const db = window.db;
  const trip = await db.getTripById(tripId);
  const vehicle = await db.getVehicleById(trip.vehicleId);
  const driver = await db.getDriverById(trip.driverId);
  const currentUser = db.getCurrentUser();

  await db.addLog(currentUser.id, currentUser.role, "SOS Panic Triggered", `CRITICAL: Driver ${driver.name} pressed Panic Button on active Trip ${tripId}. Current Location shared with Safety Department.`);
  
  showToast(`🚨 SOS ALARM SENT for Trip ${tripId}! Safety dispatch notified. Location: ${trip.routeCoordinates[trip.routeIndex]}`, "danger");

  // Visual warning on map
  const pulseCircle = L.circle(trip.routeCoordinates[trip.routeIndex], {
    color: "#ef4444",
    fillColor: "#ef4444",
    fillOpacity: 0.6,
    radius: 3000
  }).addTo(mapInstance);

  setTimeout(() => {
    if (mapInstance) mapInstance.removeLayer(pulseCircle);
  }, 10000);
}

// Helper to show toasts
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// Bind to window
window.initTrackingMap = initTrackingMap;
window.updateMapTrips = updateMapTrips;
window.triggerEmergencyAlert = triggerEmergencyAlert;
window.showToast = showToast;
