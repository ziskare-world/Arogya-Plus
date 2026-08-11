import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("ambulance-booking.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Ambulance Booking");

const mapEl = document.getElementById("ambulance-map");
const mapStatusEl = document.getElementById("map-status");
const lastLiveUpdateEl = document.getElementById("last-live-update");
const routeSummaryEl = document.getElementById("route-summary");
const ambulanceDistanceEl = document.getElementById("ambulance-distance");
const refreshIntervalInfoEl = document.getElementById("refresh-interval-info");
const mapKeyHelpEl = document.getElementById("google-map-key-help");
const activeBookingPanelEl = document.getElementById("active-booking-panel");
const historyBodyEl = document.getElementById("ambulance-history-body");

const formEl = document.getElementById("ambulance-booking-form");
const problemDescriptionInputEl = document.getElementById("problem-description-input");
const pickupInputEl = document.getElementById("pickup-location-input");
const hospitalInputEl = document.getElementById("hospital-location-input");
const pickupCoordsLabelEl = document.getElementById("pickup-coords-label");
const hospitalCoordsLabelEl = document.getElementById("hospital-coords-label");
const bookBtnEl = document.getElementById("book-ambulance-btn");

const pickupModeBtnEl = document.getElementById("mode-pickup-btn");
const hospitalModeBtnEl = document.getElementById("mode-hospital-btn");
const useCurrentBtnEl = document.getElementById("use-current-btn");

let map = null;
let pickupMarker = null;
let hospitalMarker = null;
let ambulanceMarker = null;
let selectionMode = "pickup";
let pickupCoords = null;
let hospitalCoords = null;
let bookings = [];
let activeBooking = null;
let socket = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const statusBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "completed") return '<span class="badge badge-green">Completed</span>';
  if (normalized === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  if (normalized === "arrived") return '<span class="badge badge-blue">Arrived</span>';
  if (normalized === "dispatched") return '<span class="badge badge-cyan">Dispatched</span>';
  return '<span class="badge badge-yellow">Requested</span>';
};

async function initLeafletMap() {
  if (!window.ArogyaMap) {
    if (mapStatusEl) mapStatusEl.textContent = "Map Loading...";
    setTimeout(initLeafletMap, 300);
    return;
  }

  // Detect user current location
  const userLoc = await window.ArogyaGeo.getCurrentLocation();
  pickupCoords = { lat: userLoc.latitude, lng: userLoc.longitude };

  map = window.ArogyaMap.initMap("ambulance-map", {
    lat: userLoc.latitude,
    lng: userLoc.longitude,
    zoom: 13
  });

  if (mapStatusEl) {
    mapStatusEl.textContent = "OpenStreetMap Active";
    mapStatusEl.className = "badge badge-green";
  }
  if (mapKeyHelpEl) {
    mapKeyHelpEl.textContent = "100% Free OpenStreetMap & Leaflet Routing active.";
  }

  // Set initial pickup location marker
  setPickupLocation(userLoc.latitude, userLoc.longitude, userLoc.address);

  // Map click handler to pick pickup or hospital locations
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const address = await window.ArogyaGeo.reverseGeocode(lat, lng);

    if (selectionMode === "pickup") {
      setPickupLocation(lat, lng, address);
    } else {
      setHospitalLocation(lat, lng, address);
    }
  });

  // Find nearest hospital automatically
  findNearestHospitalForPickup();

  // Initialize Socket.IO for live ambulance tracking
  if (window.io) {
    socket = window.io();
    window.ArogyaAmbulance.initLiveTracking(map, socket, (updateData) => {
      if (lastLiveUpdateEl) {
        lastLiveUpdateEl.textContent = `Live GPS Signal: ${new Date().toLocaleTimeString()}`;
      }
    });
  }
}

function setPickupLocation(lat, lng, addressStr = "") {
  pickupCoords = { lat, lng };
  if (pickupInputEl) pickupInputEl.value = addressStr || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  if (pickupCoordsLabelEl) pickupCoordsLabelEl.textContent = `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (map) {
    if (pickupMarker) map.removeLayer(pickupMarker);
    pickupMarker = window.ArogyaMap.addMarker(
      map,
      lat,
      lng,
      "patient",
      `<b>📍 Pickup Location</b><br>${addressStr || 'Requested Pickup'}`
    );
  }

  updateRouteDisplay();
}

function setHospitalLocation(lat, lng, addressStr = "") {
  hospitalCoords = { lat, lng };
  if (hospitalInputEl) hospitalInputEl.value = addressStr || `Hospital Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  if (hospitalCoordsLabelEl) hospitalCoordsLabelEl.textContent = `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (map) {
    if (hospitalMarker) map.removeLayer(hospitalMarker);
    hospitalMarker = window.ArogyaMap.addMarker(
      map,
      lat,
      lng,
      "hospital",
      `<b>🏥 Assigned Hospital</b><br>${addressStr || 'Medical Facility'}`
    );
  }

  updateRouteDisplay();
}

async function findNearestHospitalForPickup() {
  if (!pickupCoords) return;
  const hospitals = await window.ArogyaHospital.getHospitals();
  const nearest = window.ArogyaHospital.findNearestHospital(pickupCoords.lat, pickupCoords.lng, hospitals);

  if (nearest) {
    setHospitalLocation(nearest.latitude, nearest.longitude, `${nearest.name} (${nearest.specialty})`);
  }
}

async function updateRouteDisplay() {
  if (!map || !pickupCoords || !hospitalCoords) return;

  const routeData = await window.ArogyaRouting.calculateRoute(
    pickupCoords.lat,
    pickupCoords.lng,
    hospitalCoords.lat,
    hospitalCoords.lng
  );

  if (routeData) {
    window.ArogyaRouting.renderRouteOnMap(map, routeData);

    if (routeSummaryEl) {
      routeSummaryEl.textContent = `Shortest Route: ${routeData.distanceKm} km | Estimated Time: ${routeData.etaMinutes} mins`;
    }
  }
}

async function fetchMyBookings() {
  try {
    const res = await apiRequest("/api/ambulance/my-requests");
    bookings = res.data || [];
    renderHistory();
    updateActiveBookingPanel();
  } catch (err) {
    console.error("Failed to fetch bookings:", err);
  }
}

function renderHistory() {
  if (!historyBodyEl) return;
  if (!bookings || bookings.length === 0) {
    historyBodyEl.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center">No ambulance requests found.</td></tr>`;
    return;
  }

  historyBodyEl.innerHTML = bookings.map(b => `
    <tr>
      <td><code>${b._id.slice(-6).toUpperCase()}</code></td>
      <td>${escapeHtml(b.pickupLocation || "-")}</td>
      <td>${escapeHtml(b.hospitalName || b.hospitalLocation || "Auto-assigned")}</td>
      <td>${escapeHtml(b.assignedDoctorName || "Pending")}</td>
      <td>${escapeHtml(b.vehicleNumber || b.assignedAmbulanceVehicleNumber || "Assigned")}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${b.etaMinutes ? b.etaMinutes + " mins" : "Calculating"}</td>
      <td>${formatDateTime(b.createdAt)}</td>
    </tr>
  `).join("");
}

function updateActiveBookingPanel() {
  if (!activeBookingPanelEl) return;
  activeBooking = bookings.find(b => ["requested", "dispatched", "arrived"].includes(b.status));

  if (!activeBooking) {
    activeBookingPanelEl.innerHTML = `<p class="muted">No active ambulance booking.</p>`;
    return;
  }

  activeBookingPanelEl.innerHTML = `
    <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
      <h4 style="margin:0 0 6px; color: #166534;">🚑 Active Dispatch #${activeBooking._id.slice(-6).toUpperCase()}</h4>
      <p style="margin: 4px 0;"><strong>Status:</strong> ${statusBadge(activeBooking.status)}</p>
      <p style="margin: 4px 0;"><strong>Pickup:</strong> ${escapeHtml(activeBooking.pickupLocation)}</p>
      <p style="margin: 4px 0;"><strong>Hospital:</strong> ${escapeHtml(activeBooking.hospitalName || activeBooking.hospitalLocation)}</p>
      <p style="margin: 4px 0;"><strong>ETA:</strong> ${activeBooking.etaMinutes ? activeBooking.etaMinutes + ' mins' : 'En Route'}</p>
    </div>
  `;
}

// UI Event Listeners
if (pickupModeBtnEl) {
  pickupModeBtnEl.onclick = () => {
    selectionMode = "pickup";
    pickupModeBtnEl.className = "btn btn-outline btn-sm active";
    if (hospitalModeBtnEl) hospitalModeBtnEl.className = "btn btn-outline btn-sm";
  };
}

if (hospitalModeBtnEl) {
  hospitalModeBtnEl.onclick = () => {
    selectionMode = "hospital";
    hospitalModeBtnEl.className = "btn btn-outline btn-sm active";
    if (pickupModeBtnEl) pickupModeBtnEl.className = "btn btn-outline btn-sm";
  };
}

if (useCurrentBtnEl) {
  useCurrentBtnEl.onclick = async () => {
    useCurrentBtnEl.disabled = true;
    useCurrentBtnEl.textContent = "⌛ Locating...";
    try {
      const loc = await window.ArogyaGeo.getCurrentLocation();
      setPickupLocation(loc.latitude, loc.longitude, loc.address);
      if (map) map.setView([loc.latitude, loc.longitude], 14);
      findNearestHospitalForPickup();
      toast("🎯 Current location selected", "success");
    } catch (err) {
      toast("Failed to get current location", "error");
    } finally {
      useCurrentBtnEl.disabled = false;
      useCurrentBtnEl.innerHTML = "🎯 Use Current Location";
    }
  };
}

if (formEl) {
  formEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!pickupCoords) {
      toast("Please select a pickup location on the map", "error");
      return;
    }

    try {
      if (bookBtnEl) bookBtnEl.disabled = true;

      const payload = {
        pickupLocation: pickupInputEl.value || `Lat: ${pickupCoords.lat.toFixed(4)}, Lng: ${pickupCoords.lng.toFixed(4)}`,
        pickupCoordinates: pickupCoords,
        problemDescription: problemDescriptionInputEl.value,
        hospitalLocation: hospitalInputEl.value || "Nearest General Hospital",
        hospitalCoordinates: hospitalCoords
      };

      const res = await apiRequest("/api/ambulance/request", "POST", payload);
      if (res.success) {
        toast("Ambulance booked successfully! Tracking active.", "success");
        if (problemDescriptionInputEl) problemDescriptionInputEl.value = "";
        fetchMyBookings();
      } else {
        toast(res.message || "Failed to book ambulance", "error");
      }
    } catch (err) {
      toast(err.message || "Booking failed", "error");
    } finally {
      if (bookBtnEl) bookBtnEl.disabled = false;
    }
  };
}

window.refreshAmbulanceBookings = fetchMyBookings;

// Boot application
ensureSession().then(() => {
  initLeafletMap();
  fetchMyBookings();
});
