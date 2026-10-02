import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";
import { setupVoiceDictation } from "../js/voice-assistant.js";

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

// ========================================================
// LENSKART-STYLE MULTI-PROFILE CHOOSER FOR AMBULANCE
// ========================================================
let activeAmbProfileId = "self";

const getAmbAvatarMeta = (member, isSelf = false) => {
  if (isSelf) return { cls: "avatar-self", icon: "👤", tag: "Self" };
  const rel = String(member?.relationship || "").toLowerCase();
  if (rel.includes("dad") || rel.includes("father")) return { cls: "avatar-dad", icon: "👨", tag: member.relationship || "Dad" };
  if (rel.includes("mom") || rel.includes("mother")) return { cls: "avatar-mom", icon: "👩", tag: member.relationship || "Mom" };
  if (rel.includes("child") || rel.includes("son") || rel.includes("daughter")) return { cls: "avatar-child", icon: "🧒", tag: member.relationship || "Child" };
  if (rel.includes("brother") || rel.includes("sister")) return { cls: "avatar-other", icon: "🧑", tag: member.relationship || "Sibling" };
  return { cls: "avatar-other", icon: "👤", tag: member.relationship || "Profile" };
};

const loadFamilyMembers = async () => {
  try {
    const data = await apiRequest("/api/user/family-members");
    familyMembers = data.familyMembers || [];
    renderAmbProfilePills();
  } catch (e) {
    familyMembers = [];
    renderAmbProfilePills();
  }
};

const renderAmbProfilePills = () => {
  const container = document.getElementById("amb-profile-pills");
  if (!container) return;

  const countBadge = document.getElementById("amb-profile-count");
  if (countBadge) {
    const total = 1 + familyMembers.length;
    countBadge.textContent = `${total} Profile${total > 1 ? "s" : ""} in Account`;
  }

  let html = "";

  // 1. Myself Pill
  const isSelfActive = activeAmbProfileId === "self";
  html += `
    <div class="profile-pill ${isSelfActive ? "active" : ""}" data-profile-id="self" role="button" tabindex="0">
      <div class="profile-pill-avatar avatar-self">👤</div>
      <div class="profile-pill-text">
        <span class="profile-pill-name">${activeUser?.name || "Myself"}</span>
        <span class="profile-pill-tag">Primary Account</span>
      </div>
      <div class="profile-pill-check">✓</div>
    </div>
  `;

  // 2. Family Members
  familyMembers.forEach((member) => {
    const meta = getAmbAvatarMeta(member);
    const isActive = activeAmbProfileId === String(member._id);
    html += `
      <div class="profile-pill ${isActive ? "active" : ""}" data-profile-id="${member._id}" role="button" tabindex="0">
        <div class="profile-pill-avatar ${meta.cls}">${meta.icon}</div>
        <div class="profile-pill-text">
          <span class="profile-pill-name">${member.name}</span>
          <span class="profile-pill-tag">${meta.tag}</span>
        </div>
        <div class="profile-pill-check">✓</div>
      </div>
    `;
  });

  // 3. Add Profile Pill (if < 5)
  if (familyMembers.length < 5) {
    html += `
      <div class="profile-pill-add" id="amb-pill-add-profile" role="button" tabindex="0">
        <span style="font-size:1.1rem;line-height:1">➕</span>
        <span>Add Profile</span>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll(".profile-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const pid = pill.getAttribute("data-profile-id");
      selectAmbProfile(pid);
    });
  });

  const addPill = document.getElementById("amb-pill-add-profile");
  if (addPill) {
    addPill.addEventListener("click", () => {
      const drawer = document.getElementById("amb-quick-add-drawer");
      if (drawer) {
        drawer.style.display = drawer.style.display === "none" ? "grid" : "none";
        if (drawer.style.display === "grid") {
          document.getElementById("amb-quick-name")?.focus();
        }
      }
    });
  }

  updateAmbActiveStrip();
};

const selectAmbProfile = (profileId) => {
  activeAmbProfileId = String(profileId || "self");

  const container = document.getElementById("amb-profile-pills");
  if (container) {
    container.querySelectorAll(".profile-pill").forEach((pill) => {
      const pid = pill.getAttribute("data-profile-id");
      pill.classList.toggle("active", pid === activeAmbProfileId);
    });
  }

  if (activeAmbProfileId === "self") {
    if (ambTargetSelf) ambTargetSelf.checked = true;
    if (ambTargetFamily) ambTargetFamily.checked = false;
    if (useFamilyLocBtnEl) useFamilyLocBtnEl.style.display = "none";
    if (currentLocationCoords) {
      setPickupLocation(currentLocationCoords.lat, currentLocationCoords.lng, "My Current Location");
    }
  } else {
    if (ambTargetSelf) ambTargetSelf.checked = false;
    if (ambTargetFamily) ambTargetFamily.checked = true;
    if (useFamilyLocBtnEl) useFamilyLocBtnEl.style.display = "inline-block";
    if (ambFamilySelect) ambFamilySelect.value = activeAmbProfileId;

    const member = familyMembers.find((m) => String(m._id) === activeAmbProfileId);
    if (member) {
      applyFamilyMemberLocation(member);
    }
  }

  updateAmbActiveStrip();
};

const updateAmbActiveStrip = () => {
  const strip = document.getElementById("amb-active-profile-strip");
  const title = document.getElementById("amb-active-profile-title");
  const meta = document.getElementById("amb-active-profile-meta");
  if (!strip || !title) return;

  if (activeAmbProfileId === "self") {
    strip.style.display = "flex";
    strip.style.background = "#f0fdf4";
    strip.style.borderColor = "#bbf7d0";
    title.innerHTML = `👤 Ambulance Dispatch for: <strong>${activeUser?.name || "Myself"}</strong> (Primary)`;
    title.style.color = "#166534";
    if (meta) meta.textContent = "• Pickup at current GPS location";
  } else {
    const member = familyMembers.find((m) => String(m._id) === activeAmbProfileId);
    if (member) {
      strip.style.display = "flex";
      strip.style.background = "#eff6ff";
      strip.style.borderColor = "#bfdbfe";
      title.innerHTML = `👨‍👩‍👧 Ambulance Dispatch for: <strong>${member.name}</strong> (${member.relationship || "Profile"})`;
      title.style.color = "#1e40af";
      const loc = member.address || member.city || "";
      if (meta) meta.textContent = loc ? `• 📍 Remote Place: ${loc}` : "• Remote Family Member";
    }
  }
};

const initQuickAddAmbProfile = () => {
  const closeBtn = document.getElementById("amb-close-quick-add-btn");
  const saveBtn = document.getElementById("amb-save-quick-btn");
  const drawer = document.getElementById("amb-quick-add-drawer");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (drawer) drawer.style.display = "none";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("amb-quick-name");
      const relInput = document.getElementById("amb-quick-rel");
      const addrInput = document.getElementById("amb-quick-address");

      const name = nameInput?.value.trim();
      if (!name) {
        toast("Profile Name is required", "warning");
        nameInput?.focus();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const payload = {
          name,
          relationship: relInput?.value || "Other",
          address: addrInput?.value.trim() || undefined,
          city: addrInput?.value.trim() || undefined
        };

        const res = await apiRequest("/api/user/family-members", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        toast(`Profile "${name}" added to account!`, "success");
        if (drawer) drawer.style.display = "none";
        if (nameInput) nameInput.value = "";
        if (addrInput) addrInput.value = "";

        await loadFamilyMembers();
        if (res.familyMember?._id) {
          selectAmbProfile(res.familyMember._id);
        }
      } catch (err) {
        toast(err.message || "Failed to add profile", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save & Select";
      }
    });
  }
};

const getSelectedFamilyMember = () => {
  if (activeAmbProfileId === "self") return null;
  return familyMembers.find((m) => String(m._id) === activeAmbProfileId) || null;
};

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

  if (familyId) {
    selectAmbProfile(familyId);
  }
};

// Boot application
initLeafletMap();
initQuickAddAmbProfile();

// Initialize Voice Dictation for Emergency Condition
const voiceEmergencyBtn = document.getElementById("voice-emergency-btn");
const voiceEmergencyStatus = document.getElementById("voice-emergency-status");

if (voiceEmergencyBtn && problemDescriptionInputEl) {
  setupVoiceDictation({
    buttonEl: voiceEmergencyBtn,
    inputEl: problemDescriptionInputEl,
    statusEl: voiceEmergencyStatus,
    onResult: (text) => {
      if (text) {
        toast(`Emergency condition transcribed: "${text}"`, "info");
      }
    }
  });
}

ensureSession({
  allowedRoles: ["patient", "admin", "super-admin"]
}).then((session) => {
  if (session?.user) activeUser = session.user;
  loadFamilyMembers().then(() => {
    handleUrlParams();
  });
  fetchMyBookings();
});
