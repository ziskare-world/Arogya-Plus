import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("ambulance-booking.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Ambulance Booking & Emergency Dispatch");

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
const useCurrentBtnEl = document.getElementById("use-current-btn");
const useFamilyLocBtnEl = document.getElementById("use-family-loc-btn");
const selectNearestHospitalBtnEl = document.getElementById("select-nearest-hospital-btn");

// Family Controls
const ambTargetSelf = document.getElementById("amb-target-self");
const ambTargetFamily = document.getElementById("amb-target-family");
const ambFamilyWrapper = document.getElementById("amb-family-wrapper");
const ambFamilySelect = document.getElementById("amb-family-select");
const ambFamilyDetails = document.getElementById("amb-family-details");

let map = null;
let pickupMarker = null;
let hospitalMarker = null;
let ambulanceMarker = null;
let selectionMode = "pickup";
let pickupCoords = null;
let hospitalCoords = null;
let bookings = [];
let activeBooking = null;
let familyMembers = [];
let activeUser = null;
let currentLocationCoords = null;

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

// ==========================================
// FAMILY MEMBER INTEGRATION
// ==========================================
const loadFamilyMembers = async () => {
  try {
    const data = await apiRequest("/api/user/family-members");
    familyMembers = data.familyMembers || [];
    renderFamilyOptions();
  } catch (e) {
    familyMembers = [];
  }
};

const renderFamilyOptions = () => {
  if (!ambFamilySelect) return;
  if (!familyMembers.length) {
    ambFamilySelect.innerHTML = '<option value="">No family members added yet. Add in Profile.</option>';
    return;
  }

  ambFamilySelect.innerHTML = '<option value="">-- Choose family member --</option>' +
    familyMembers.map((m) => {
      const blood = m.bloodGroup && m.bloodGroup !== "Unknown" ? ` [${m.bloodGroup}]` : "";
      const loc = m.city || m.address || "Remote Location";
      return `<option value="${m._id}">${m.name} (${m.relationship})${blood} - 📍 ${loc}</option>`;
    }).join("");
};

const getSelectedFamilyMember = () => {
  const id = ambFamilySelect?.value;
  if (!id) return null;
  return familyMembers.find((m) => String(m._id) === String(id)) || null;
};

// Dispatch target change
document.querySelectorAll('input[name="amb-target"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isFamily = ambTargetFamily?.checked;
    if (ambFamilyWrapper) ambFamilyWrapper.style.display = isFamily ? "block" : "none";
    if (useFamilyLocBtnEl) useFamilyLocBtnEl.style.display = isFamily ? "inline-block" : "none";

    if (isFamily) {
      if (familyMembers.length && ambFamilySelect && !ambFamilySelect.value) {
        ambFamilySelect.value = familyMembers[0]._id;
        ambFamilySelect.dispatchEvent(new Event("change"));
      }
    } else {
      if (ambFamilyDetails) ambFamilyDetails.textContent = "";
      if (currentLocationCoords) {
        setPickupLocation(currentLocationCoords.lat, currentLocationCoords.lng, "My Current Location");
      }
    }
  });
});

ambFamilySelect?.addEventListener("change", () => {
  const member = getSelectedFamilyMember();
  if (!member) {
    if (ambFamilyDetails) ambFamilyDetails.textContent = "";
    return;
  }

  const blood = member.bloodGroup && member.bloodGroup !== "Unknown" ? member.bloodGroup : "N/A";
  if (ambFamilyDetails) {
    ambFamilyDetails.innerHTML = `
      <strong>${member.name} (${member.relationship})</strong> • Age: ${member.age || "N/A"} • Blood: <span style="color:#ef4444">${blood}</span><br>
      📍 Remote Place: <strong>${member.address || member.city || "Remote Address"}</strong>
    `;
  }

  applyFamilyMemberLocation(member);
});

const applyFamilyMemberLocation = (member) => {
  if (!member) return;
  const address = member.address || (member.city ? `${member.city}, India` : "Remote Location");
  if (pickupInputEl) pickupInputEl.value = address;

  if (member.coordinates?.lat && member.coordinates?.lng) {
    setPickupLocation(member.coordinates.lat, member.coordinates.lng, address);
    if (map) map.setView([member.coordinates.lat, member.coordinates.lng], 14);
    findNearestHospitalForPickup();
  } else {
    // Geocode remote city
    if (window.ArogyaGeo && member.city) {
      window.ArogyaGeo.searchPlaces(member.city).then((results) => {
        if (results && results.length) {
          const first = results[0];
          setPickupLocation(first.lat, first.lng, address);
          if (map) map.setView([first.lat, first.lng], 14);
          findNearestHospitalForPickup();
        }
      });
    }
  }
};

useFamilyLocBtnEl?.addEventListener("click", () => {
  const member = getSelectedFamilyMember();
  if (member) {
    applyFamilyMemberLocation(member);
    toast(`Set pickup to ${member.name}'s remote address`, "success");
  } else {
    toast("Please select a family member first", "warning");
  }
});

// ==========================================
// LEAFLET GIS MAP & ROUTING
// ==========================================
async function initLeafletMap() {
  if (!window.ArogyaMap || !window.L) {
    if (mapStatusEl) mapStatusEl.textContent = "Map Loading...";
    setTimeout(initLeafletMap, 150);
    return;
  }

  const defaultLat = 28.6139;
  const defaultLng = 77.2090;
  const defaultAddress = "Connaught Place, New Delhi, India";

  map = window.ArogyaMap.initMap("ambulance-map", {
    lat: defaultLat,
    lng: defaultLng,
    zoom: 13
  });

  if (mapStatusEl) {
    mapStatusEl.textContent = "Interactive GIS Active";
    mapStatusEl.className = "badge badge-green";
  }
  if (mapKeyHelpEl) {
    mapKeyHelpEl.textContent = "Live GIS routing & autonomous dispatch active.";
  }

  setPickupLocation(defaultLat, defaultLng, defaultAddress);

  // Map click handler to set pickup location
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const address = window.ArogyaGeo ? await window.ArogyaGeo.reverseGeocode(lat, lng) : "";
    setPickupLocation(lat, lng, address);
    findNearestHospitalForPickup();
  });
}

function setPickupLocation(lat, lng, addressStr = "") {
  pickupCoords = { lat: Number(lat), lng: Number(lng) };

  if (pickupInputEl && addressStr) {
    pickupInputEl.value = addressStr;
  }
  if (pickupCoordsLabelEl) {
    pickupCoordsLabelEl.textContent = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  if (map) {
    if (pickupMarker) {
      pickupMarker.setLatLng([lat, lng]);
    } else {
      pickupMarker = window.L.marker([lat, lng], {
        icon: window.ArogyaMap.createCustomIcon("📍", "#ef4444")
      }).addTo(map);
    }
    pickupMarker.bindPopup(`<b>📍 Patient Pickup Location</b><br>${addressStr || "Pickup Point"}`).openPopup();
  }

  updateRouteDisplay();
}

function setHospitalLocation(lat, lng, addressStr = "") {
  hospitalCoords = { lat: Number(lat), lng: Number(lng) };

  if (hospitalInputEl && addressStr) {
    hospitalInputEl.value = addressStr;
  }
  if (hospitalCoordsLabelEl) {
    hospitalCoordsLabelEl.textContent = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  if (map) {
    if (hospitalMarker) {
      hospitalMarker.setLatLng([lat, lng]);
    } else {
      hospitalMarker = window.L.marker([lat, lng], {
        icon: window.ArogyaMap.createCustomIcon("🏥", "#2563eb")
      }).addTo(map);
    }
    hospitalMarker.bindPopup(`<b>🏥 Assigned Emergency Hospital</b><br>${addressStr || "Medical Facility"}`);
  }

  updateRouteDisplay();
}

async function findNearestHospitalForPickup() {
  if (!pickupCoords || !window.ArogyaHospital) return;
  try {
    const hospitals = await window.ArogyaHospital.getHospitals();
    const nearest = window.ArogyaHospital.findNearestHospital(pickupCoords.lat, pickupCoords.lng, hospitals);

    if (nearest) {
      const distText = nearest.distanceKm ? ` (${nearest.distanceKm} km away)` : "";
      setHospitalLocation(nearest.latitude, nearest.longitude, `${nearest.name}${distText}`);
    }
  } catch (e) {
    // Non-critical fallback
  }
}

async function updateRouteDisplay() {
  if (!map || !pickupCoords || !hospitalCoords || !window.ArogyaRouting) return;

  const routeData = await window.ArogyaRouting.calculateRoute(
    pickupCoords.lat,
    pickupCoords.lng,
    hospitalCoords.lat,
    hospitalCoords.lng
  );

  if (routeData) {
    window.ArogyaRouting.renderRouteOnMap(map, routeData);
    if (routeSummaryEl) {
      routeSummaryEl.textContent = `Shortest Route: ${routeData.distanceKm} km | Estimated ETA: ${routeData.etaMinutes} mins`;
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

  historyBodyEl.innerHTML = bookings
    .map((b) => {
      const isFamily = b.bookedFor === "family";
      const patientName = b.patientDetails?.name || "Self";
      const forTag = isFamily ? `<br><small style="color:#d97706">👨‍👩‍👧 For: ${patientName}</small>` : "";

      return `
        <tr>
          <td><code>${b._id.slice(-6).toUpperCase()}</code>${forTag}</td>
          <td>${escapeHtml(b.pickupLocation || "-")}</td>
          <td>${escapeHtml(b.hospitalName || b.hospitalLocation || "Auto-assigned")}</td>
          <td>${escapeHtml(b.assignedDoctorName || "Pending")}</td>
          <td>${escapeHtml(b.vehicleNumber || b.assignedAmbulanceVehicleNumber || "Assigned")}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${b.etaMinutes ? b.etaMinutes + " mins" : "En route"}</td>
          <td>${formatDateTime(b.createdAt)}</td>
        </tr>
      `;
    })
    .join("");
}

function updateActiveBookingPanel() {
  if (!activeBookingPanelEl) return;
  activeBooking = bookings.find((b) => ["requested", "dispatched", "arrived"].includes(b.status));

  if (!activeBooking) {
    activeBookingPanelEl.innerHTML = `<p class="muted">No active ambulance booking.</p>`;
    return;
  }

  const isFamily = activeBooking.bookedFor === "family";
  const forLabel = isFamily ? `👨‍👩‍👧 For: ${activeBooking.patientDetails?.name || "Family Member"}` : "👤 For: Myself";

  activeBookingPanelEl.innerHTML = `
    <div style="padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h4 style="margin:0; color: #166534;">🚑 Active Dispatch #${activeBooking._id.slice(-6).toUpperCase()}</h4>
        <span class="badge badge-green">${activeBooking.status.toUpperCase()}</span>
      </div>
      <p style="margin: 3px 0; font-size:0.88rem"><strong>${forLabel}</strong></p>
      <p style="margin: 3px 0; font-size:0.88rem"><strong>Vehicle:</strong> ${activeBooking.vehicleNumber || "Assigned Ambulance"} (Driver: ${activeBooking.driverName || "Emergency Crew"})</p>
      <p style="margin: 3px 0; font-size:0.88rem"><strong>Pickup:</strong> ${escapeHtml(activeBooking.pickupLocation)}</p>
      <p style="margin: 3px 0; font-size:0.88rem"><strong>Assigned Hospital:</strong> ${escapeHtml(activeBooking.hospitalName || activeBooking.hospitalLocation)}</p>
      <p style="margin: 3px 0; font-size:0.88rem; color:#166534"><strong>Estimated Arrival:</strong> ${activeBooking.etaMinutes ? activeBooking.etaMinutes + " mins" : "Approaching"}</p>
    </div>
  `;
}

// Button listeners
if (pickupModeBtnEl) {
  pickupModeBtnEl.onclick = () => {
    selectionMode = "pickup";
    pickupModeBtnEl.className = "btn btn-outline btn-sm active";
  };
}

if (selectNearestHospitalBtnEl) {
  selectNearestHospitalBtnEl.onclick = async () => {
    await findNearestHospitalForPickup();
    toast("🏥 Nearest Emergency Hospital selected", "success");
  };
}

if (useCurrentBtnEl) {
  useCurrentBtnEl.onclick = async () => {
    useCurrentBtnEl.disabled = true;
    useCurrentBtnEl.textContent = "⌛ Locating...";
    try {
      if (window.ArogyaGeo) {
        const loc = await window.ArogyaGeo.getCurrentLocation();
        currentLocationCoords = { lat: loc.latitude, lng: loc.longitude };
        setPickupLocation(loc.latitude, loc.longitude, loc.address);
        if (map) map.setView([loc.latitude, loc.longitude], 14);
        findNearestHospitalForPickup();
        toast("🎯 Current location selected", "success");
      }
    } catch (err) {
      toast("Failed to get current location", "error");
    } finally {
      useCurrentBtnEl.disabled = false;
      useCurrentBtnEl.innerHTML = "🎯 Current GPS";
    }
  };
}

// Autonomous Ambulance Booking Submission
if (formEl) {
  formEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!pickupCoords) {
      toast("Please select a pickup location on the map", "error");
      return;
    }

    const isFamily = ambTargetFamily?.checked;
    const selectedMember = isFamily ? getSelectedFamilyMember() : null;

    if (isFamily && !selectedMember) {
      toast("Please select a family member profile", "warning");
      return;
    }

    try {
      if (bookBtnEl) {
        bookBtnEl.disabled = true;
        bookBtnEl.textContent = "🚨 Autonomous AI Dispatching...";
      }

      const patientDetails = isFamily && selectedMember
        ? {
            name: selectedMember.name,
            relationship: selectedMember.relationship,
            phone: selectedMember.phone,
            age: selectedMember.age,
            gender: selectedMember.gender
          }
        : {
            name: activeUser?.name || "Self",
            relationship: "Self",
            phone: activeUser?.phone,
            age: activeUser?.age,
            gender: activeUser?.gender
          };

      const payload = {
        pickupLocation: pickupInputEl.value || `Lat: ${pickupCoords.lat.toFixed(4)}, Lng: ${pickupCoords.lng.toFixed(4)}`,
        pickupCoordinates: pickupCoords,
        problemDescription: problemDescriptionInputEl.value,
        bookedFor: isFamily ? "family" : "self",
        familyMemberId: isFamily && selectedMember ? selectedMember._id : null,
        patientDetails,
        locationType: isFamily ? "remote_saved" : "current",
        hospitalLocation: hospitalInputEl.value || "Nearest Emergency Hospital",
        hospitalCoordinates: hospitalCoords,
        priority: "high"
      };

      // Call AI Auto-Dispatch Endpoint
      const res = await apiRequest("/api/ai/auto-dispatch-ambulance", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res.success) {
        const vehicle = res.dispatchedVehicle?.vehicleNumber || "Assigned Ambulance";
        const eta = res.etaMinutes || 10;
        toast(`🚨 AI Dispatched ${vehicle}! ETA: ${eta} minutes to ${payload.pickupLocation}.`, "success");
        if (problemDescriptionInputEl) problemDescriptionInputEl.value = "";
        fetchMyBookings();
      } else {
        toast(res.message || "Failed to dispatch ambulance", "error");
      }
    } catch (err) {
      toast(err.message || "Dispatch failed", "error");
    } finally {
      if (bookBtnEl) {
        bookBtnEl.disabled = false;
        bookBtnEl.textContent = "🚨 AI Auto-Dispatch Closest Ambulance";
      }
    }
  };
}

window.refreshAmbulanceBookings = fetchMyBookings;

// Handle URL parameters (e.g. ?familyId=...)
const handleUrlParams = () => {
  const url = new URL(window.location.href);
  const familyId = url.searchParams.get("familyId");

  if (familyId && ambTargetFamily) {
    ambTargetFamily.checked = true;
    ambTargetFamily.dispatchEvent(new Event("change"));
    if (ambFamilySelect) {
      ambFamilySelect.value = familyId;
      ambFamilySelect.dispatchEvent(new Event("change"));
    }
  }
};

// Boot application
initLeafletMap();

ensureSession({
  allowedRoles: ["patient", "admin", "super-admin"]
}).then((session) => {
  if (session?.user) activeUser = session.user;
  loadFamilyMembers().then(() => {
    handleUrlParams();
  });
  fetchMyBookings();
});
