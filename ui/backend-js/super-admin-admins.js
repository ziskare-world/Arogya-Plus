import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("admins.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Hospital Management");

const modalEl = document.getElementById("admin-modal");
const formEl = document.getElementById("admin-form");
const submitBtnEl = document.getElementById("create-admin-btn");
const adminsTbodyEl = document.getElementById("admins-tbody");
const hospitalIdsModalEl = document.getElementById("hospital-ids-modal");
const hospitalIdsTitleEl = document.getElementById("hospital-ids-title");
const hospitalIdsMetaEl = document.getElementById("hospital-ids-meta");
const hospitalIdsListEl = document.getElementById("hospital-ids-list");
const hospitalEditModalEl = document.getElementById("hospital-edit-modal");
const hospitalEditFormEl = document.getElementById("hospital-edit-form");
const currentHospitalNameEditEl = document.getElementById("edit-current-hospital-name");
const hospitalNameEditEl = document.getElementById("edit-hospital-name");
const hospitalAddressEditEl = document.getElementById("edit-hospital-address");
const hospitalLatEditEl = document.getElementById("edit-hospital-lat");
const hospitalLngEditEl = document.getElementById("edit-hospital-lng");
const updateHospitalBtnEl = document.getElementById("update-hospital-btn");
const adminPasswordModalEl = document.getElementById("admin-password-modal");
const adminPasswordFormEl = document.getElementById("admin-password-form");
const adminPasswordMetaEl = document.getElementById("admin-password-meta");
const newAdminPasswordEl = document.getElementById("new-admin-password");
const confirmAdminPasswordEl = document.getElementById("confirm-admin-password");
const updateAdminPasswordBtnEl = document.getElementById("update-admin-password-btn");

const hospitalNameInputEl = document.getElementById("admin-hospital");
const hospitalAddressInputEl = document.getElementById("admin-hospital-address");
const addressSearchBtnEl = document.getElementById("admin-address-search-btn");
const mapEl = document.getElementById("admin-hospital-map");
const mapStatusEl = document.getElementById("admin-map-status");
const mapHelpEl = document.getElementById("admin-map-help");
const coordsLabelEl = document.getElementById("admin-coords-label");

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

let admins = [];
let hospitalCoordinates = null;
let hospitalMap = null;
let hospitalMarker = null;
let hospitalGeocoder = null;
let mapLoaderPromise = null;
let mapInitialized = false;
let mapAutocomplete = null;
let cachedPublicGoogleMapsApiKey;
let groupedHospitalAdmins = [];
let selectedHospitalGroupKey = "";
let selectedAdminIdForPassword = "";

const shortId = (value) => {
  const id = String(value || "");
  return id ? `ADM-${id.slice(-6).toUpperCase()}` : "-";
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const accessBadge = (accessLevel) => {
  if (accessLevel === "full") return '<span class="badge badge-blue">Full</span>';
  if (accessLevel === "operations") return '<span class="badge badge-cyan">Operations</span>';
  if (accessLevel === "receptionist") return '<span class="badge badge-purple">Receptionist</span>';
  return '<span class="badge badge-yellow">Limited</span>';
};

const ACCESS_LEVEL_ORDER = {
  operations: 0,
  receptionist: 1,
  full: 2,
  limited: 3
};

const accessLevelLabel = (accessLevel) => {
  if (accessLevel === "operations") return "Operations";
  if (accessLevel === "receptionist") return "Receptionist";
  if (accessLevel === "full") return "Full";
  return "Limited";
};

const sortAdminsWithinHospital = (a, b) => {
  const rankA = ACCESS_LEVEL_ORDER[String(a.accessLevel || "").toLowerCase()] ?? 99;
  const rankB = ACCESS_LEVEL_ORDER[String(b.accessLevel || "").toLowerCase()] ?? 99;
  if (rankA !== rankB) return rankA - rankB;

  const identityA = String(a.name || a.email || a._id || a.id || "");
  const identityB = String(b.name || b.email || b._id || b.id || "");
  return identityA.localeCompare(identityB);
};

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const normalizeHospitalName = (value = "") => String(value || "").trim();

const normalizeCoordsInput = (latValue, lngValue) => {
  const latText = String(latValue ?? "").trim();
  const lngText = String(lngValue ?? "").trim();
  if (!latText && !lngText) return undefined;
  if (!latText || !lngText) {
    throw new Error("Both latitude and longitude are required");
  }

  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid latitude/longitude");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Latitude/longitude out of range");
  }
  return { lat, lng };
};

const groupAdminsByHospital = (list) => {
  const map = new Map();

  list.forEach((admin) => {
    const rawHospitalName = normalizeHospitalName(admin.hospitalName);
    const hasHospitalName = Boolean(rawHospitalName);
    const hospitalName = hasHospitalName ? rawHospitalName : "Unknown Hospital";
    const key = hasHospitalName
      ? rawHospitalName.toLowerCase()
      : `unknown-${String(admin._id || admin.id || Math.random())}`;

    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        hospitalName,
        hospitalAddress: String(admin.hospitalAddress || "").trim(),
        hospitalCoordinates: admin.hospitalCoordinates || null,
        admins: []
      });
    }

    const group = map.get(key);
    if (!group.hospitalAddress && admin.hospitalAddress) {
      group.hospitalAddress = String(admin.hospitalAddress || "").trim();
    }
    if (!group.hospitalCoordinates && admin.hospitalCoordinates) {
      group.hospitalCoordinates = admin.hospitalCoordinates;
    }
    group.admins.push(admin);
  });

  return Array.from(map.values()).sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));
};

const renderStats = (list) => {
  const activeCount = list.filter((item) => item.isActive).length;
  const opsReceptionCount = list.filter(
    (item) => item.accessLevel === "operations" || item.accessLevel === "receptionist"
  ).length;
  const hospitalCount = new Set(list.map((item) => String(item.hospitalName || "").trim()).filter(Boolean)).size;

  const countEl = document.getElementById("admin-count");
  const activeEl = document.getElementById("admin-active-count");
  const hospitalEl = document.getElementById("admin-hospital-count");
  const fullEl = document.getElementById("admin-full-count");
  const subtitleEl = document.getElementById("admin-subtitle");

  if (countEl) countEl.textContent = String(list.length);
  if (activeEl) activeEl.textContent = String(activeCount);
  if (hospitalEl) hospitalEl.textContent = String(hospitalCount);
  if (fullEl) fullEl.textContent = String(opsReceptionCount);
  if (subtitleEl) subtitleEl.textContent = `${list.length} hospital admin ID(s) in the network`;
};

const renderAdmins = (list) => {
  const tbody = document.getElementById("admins-tbody");
  if (!tbody) return;

  const groupedHospitals = groupAdminsByHospital(list);
  groupedHospitalAdmins = groupedHospitals;

  if (!groupedHospitals.length) {
    groupedHospitalAdmins = [];
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-400)">No admin accounts found.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = groupedHospitals
    .map(
      (hospitalGroup) => {
        const entries = [...hospitalGroup.admins].sort(sortAdminsWithinHospital);
        const activeCount = entries.filter((entry) => entry.isActive).length;
        const hasOperations = entries.some((entry) => entry.accessLevel === "operations");
        const hasReceptionist = entries.some((entry) => entry.accessLevel === "receptionist");
        const newestCreatedAt = entries
          .map((entry) => new Date(entry.createdAt))
          .filter((value) => !Number.isNaN(value.getTime()))
          .sort((a, b) => b - a)[0];

        const createdOn = newestCreatedAt ? formatDate(newestCreatedAt) : "-";
        const hospitalLocation =
          hospitalGroup.hospitalAddress ||
          (hospitalGroup.hospitalCoordinates
            ? `${Number(hospitalGroup.hospitalCoordinates.lat).toFixed(6)}, ${Number(
                hospitalGroup.hospitalCoordinates.lng
              ).toFixed(6)}`
            : "-");

        const idSummary =
          hasOperations && hasReceptionist
            ? "Operations + Receptionist"
            : "View all hospital IDs";
        const viewIdsLabel = `View ${entries.length} ID${entries.length > 1 ? "s" : ""}`;

        return `
        <tr>
          <td>${escapeHtml(hospitalGroup.hospitalName || "-")}</td>
          <td>${escapeHtml(hospitalLocation)}</td>
          <td>
            <button
              class="btn btn-outline btn-sm"
              type="button"
              data-action="view-hospital-ids"
              data-group-key="${encodeURIComponent(hospitalGroup.groupKey || "")}"
            >
              ${escapeHtml(viewIdsLabel)}
            </button>
            <div style="margin-top:6px;font-size:.72rem;color:var(--text-500)">${escapeHtml(idSummary)}</div>
          </td>
          <td>
            <span class="badge badge-blue">${activeCount}/${entries.length} Active</span>
          </td>
          <td>${escapeHtml(createdOn)}</td>
          <td>
            <div class="action-stack">
              <button
                class="btn btn-outline btn-sm"
                type="button"
                data-action="edit-hospital"
                data-group-key="${encodeURIComponent(hospitalGroup.groupKey || "")}"
                ${hospitalGroup.hospitalName && hospitalGroup.hospitalName !== "Unknown Hospital"
                  ? ""
                  : "disabled"}
              >
                Edit Hospital
              </button>
              <button
                class="btn btn-outline btn-sm"
                type="button"
                style="border-color:#fecaca;color:#dc2626"
                data-action="delete-hospital"
                data-hospital="${encodeURIComponent(hospitalGroup.hospitalName || "")}"
                ${hospitalGroup.hospitalName && hospitalGroup.hospitalName !== "Unknown Hospital"
                  ? ""
                  : "disabled"}
              >
                Delete Hospital
              </button>
            </div>
          </td>
        </tr>`;
      }
    )
    .join("");
};

const formatHospitalLocation = (hospitalGroup) =>
  hospitalGroup.hospitalAddress ||
  (hospitalGroup.hospitalCoordinates
    ? `${Number(hospitalGroup.hospitalCoordinates.lat).toFixed(6)}, ${Number(
        hospitalGroup.hospitalCoordinates.lng
      ).toFixed(6)}`
    : "-");

const openHospitalIdsModal = (hospitalGroup) => {
  if (!hospitalIdsModalEl || !hospitalIdsListEl || !hospitalGroup) return;

  const entries = [...hospitalGroup.admins].sort(sortAdminsWithinHospital);
  const activeCount = entries.filter((entry) => entry.isActive).length;
  const hospitalName = hospitalGroup.hospitalName || "Hospital";
  const hospitalLocation = formatHospitalLocation(hospitalGroup);

  if (hospitalIdsTitleEl) {
    hospitalIdsTitleEl.textContent = `${hospitalName} Admin IDs`;
  }

  if (hospitalIdsMetaEl) {
    hospitalIdsMetaEl.textContent = `${entries.length} ID(s) | ${activeCount} active | ${hospitalLocation}`;
  }

  if (!entries.length) {
    hospitalIdsListEl.innerHTML =
      '<div class="id-popup-item" style="text-align:center;color:var(--text-500)">No IDs found for this hospital.</div>';
    hospitalIdsModalEl.classList.remove("hidden");
    return;
  }

  hospitalIdsListEl.innerHTML = entries
    .map(
      (entry) => `
        <div class="id-popup-item">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <code style="color:var(--blue)">${shortId(entry._id || entry.id)}</code>
            ${accessBadge(entry.accessLevel)}
          </div>
          <div style="margin-top:6px;font-size:.84rem;color:var(--text-300)">${escapeHtml(entry.name || "-")}</div>
          <div style="margin-top:4px;font-size:.76rem;color:var(--text-400)">${escapeHtml(entry.email || "-")}</div>
          <div style="margin-top:4px;font-size:.72rem;color:var(--text-500)">
            Role: ${escapeHtml(accessLevelLabel(entry.accessLevel))}
          </div>
          <div style="margin-top:4px;font-size:.72rem;color:var(--text-500)">
            ${entry.isActive ? "Active" : "Inactive"}
          </div>
          <div style="margin-top:8px">
            <button
              class="btn btn-outline btn-sm"
              type="button"
              data-action="update-admin-password"
              data-admin-id="${encodeURIComponent(String(entry._id || entry.id || ""))}"
            >
              Update Password
            </button>
          </div>
        </div>`
    )
    .join("");

  hospitalIdsModalEl.classList.remove("hidden");
};

window.closeHospitalIdsModal = function closeHospitalIdsModal() {
  if (hospitalIdsModalEl) hospitalIdsModalEl.classList.add("hidden");
};

window.closeHospitalEditModal = function closeHospitalEditModal() {
  selectedHospitalGroupKey = "";
  if (hospitalEditModalEl) hospitalEditModalEl.classList.add("hidden");
  if (hospitalEditFormEl) hospitalEditFormEl.reset();
};

window.closeAdminPasswordModal = function closeAdminPasswordModal() {
  selectedAdminIdForPassword = "";
  if (adminPasswordModalEl) adminPasswordModalEl.classList.add("hidden");
  if (adminPasswordFormEl) adminPasswordFormEl.reset();
  if (adminPasswordMetaEl) adminPasswordMetaEl.textContent = "-";
};

const openHospitalEditModal = (hospitalGroup) => {
  if (!hospitalGroup || !hospitalEditModalEl) return;
  const currentName = String(hospitalGroup.hospitalName || "").trim();
  const address = String(hospitalGroup.hospitalAddress || "").trim();
  const coords = hospitalGroup.hospitalCoordinates || null;

  selectedHospitalGroupKey = hospitalGroup.groupKey || "";
  if (currentHospitalNameEditEl) currentHospitalNameEditEl.value = currentName;
  if (hospitalNameEditEl) hospitalNameEditEl.value = currentName;
  if (hospitalAddressEditEl) hospitalAddressEditEl.value = address;
  if (hospitalLatEditEl) hospitalLatEditEl.value = coords?.lat ?? "";
  if (hospitalLngEditEl) hospitalLngEditEl.value = coords?.lng ?? "";

  hospitalEditModalEl.classList.remove("hidden");
};

const openAdminPasswordModal = (admin) => {
  if (!admin || !adminPasswordModalEl) return;
  selectedAdminIdForPassword = String(admin._id || admin.id || "");
  if (!selectedAdminIdForPassword) {
    toast("Admin ID missing", "error");
    return;
  }

  if (adminPasswordMetaEl) {
    adminPasswordMetaEl.textContent = `${admin.name || "Admin"} | ${admin.email || "-"} | ${
      admin.hospitalName || "-"
    }`;
  }

  if (adminPasswordFormEl) adminPasswordFormEl.reset();
  adminPasswordModalEl.classList.remove("hidden");
};

const updateHospitalDetails = async ({ currentHospitalName, hospitalName, hospitalAddress, hospitalCoordinates }) =>
  apiRequest("/api/admin/hospitals", {
    method: "PATCH",
    body: JSON.stringify({
      currentHospitalName,
      hospitalName,
      hospitalAddress,
      hospitalCoordinates
    })
  });

const updateAdminPassword = async ({ adminId, password }) =>
  apiRequest(`/api/admin/admins/${adminId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password })
  });

const loadAdmins = async () => {
  if (hospitalIdsModalEl) hospitalIdsModalEl.classList.add("hidden");
  const data = await apiRequest("/api/admin/users?role=admin");
  admins = data.users || [];
  renderStats(admins);
  renderAdmins(admins);
};

const normalizeApiKey = (value) => String(value || "").trim();

const fetchPublicGoogleMapsApiKey = async () => {
  if (cachedPublicGoogleMapsApiKey !== undefined) return cachedPublicGoogleMapsApiKey;

  try {
    const response = await fetch("/api/public-config", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });

    if (!response.ok) {
      cachedPublicGoogleMapsApiKey = "";
      return "";
    }

    const data = await response.json();
    const key = normalizeApiKey(data?.googleMapsApiKey);
    cachedPublicGoogleMapsApiKey = key;
    return key;
  } catch {
    cachedPublicGoogleMapsApiKey = "";
    return "";
  }
};

const getGoogleMapsApiKey = async () => {
  const runtimeKey = normalizeApiKey(window.GOOGLE_MAPS_API_KEY);
  if (runtimeKey) return runtimeKey;

  const publicKey = await fetchPublicGoogleMapsApiKey();
  if (publicKey) return publicKey;

  return normalizeApiKey(localStorage.getItem("google_maps_api_key"));
};

const setMapStatus = (label, badgeClass = "badge-blue") => {
  if (!mapStatusEl) return;
  mapStatusEl.className = `badge ${badgeClass}`;
  mapStatusEl.textContent = label;
};

const normalizeCoords = (coords) => {
  if (!coords || typeof coords !== "object") return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const setCoordsLabel = () => {
  if (!coordsLabelEl) return;
  if (!hospitalCoordinates) {
    coordsLabelEl.textContent = "Coordinates: -";
    return;
  }
  coordsLabelEl.textContent = `Coordinates: ${hospitalCoordinates.lat.toFixed(6)}, ${hospitalCoordinates.lng.toFixed(6)}`;
};

const reverseGeocode = async (coords) => {
  if (!coords) return "";
  return await window.ArogyaGeo.reverseGeocode(coords.lat, coords.lng);
};

const geocodeByAddress = async (address) => {
  const query = String(address || "").trim();
  if (!query) return null;
  const results = await window.ArogyaGeo.geocodeAddress(query);
  if (!results || results.length === 0) return null;
  return {
    coords: { lat: results[0].latitude, lng: results[0].longitude },
    address: results[0].displayName || query
  };
};

const setHospitalLocation = (coords, address = "") => {
  const normalized = normalizeCoords(coords);
  if (!normalized) return;

  hospitalCoordinates = normalized;
  setCoordsLabel();

  if (hospitalAddressInputEl && address) {
    hospitalAddressInputEl.value = address;
  }

  if (!hospitalMap) return;

  if (hospitalMarker) {
    hospitalMap.removeLayer(hospitalMarker);
  }

  hospitalMarker = window.ArogyaMap.addMarker(
    hospitalMap,
    normalized.lat,
    normalized.lng,
    "hospital",
    `<b>🏥 ${hospitalNameInputEl?.value || 'Hospital Location'}</b>`
  );

  hospitalMap.setView([normalized.lat, normalized.lng], 15);
};

const resetHospitalLocation = ({ clearAddress = false } = {}) => {
  hospitalCoordinates = null;
  setCoordsLabel();

  if (hospitalMarker && hospitalMap) {
    hospitalMap.removeLayer(hospitalMarker);
    hospitalMarker = null;
  }

  if (clearAddress && hospitalAddressInputEl) {
    hospitalAddressInputEl.value = "";
  }
};

const locateAddressOnMap = async () => {
  const address = String(hospitalAddressInputEl?.value || "").trim();
  if (!address) {
    throw new Error("Enter hospital address before locating on map");
  }

  if (!mapInitialized || !hospitalMap) {
    const ready = await initializeHospitalMap();
    if (!ready) {
      throw new Error("Leaflet Map is not ready");
    }
  }

  setMapStatus("Locating", "badge-cyan");
  const result = await geocodeByAddress(address);
  if (!result) {
    setMapStatus("Ready", "badge-green");
    throw new Error("Could not find this address on map");
  }

  setHospitalLocation(result.coords, result.address);
  setMapStatus("Ready", "badge-green");
  if (mapHelpEl) {
    mapHelpEl.textContent = "Address located. You can click map to adjust exact hospital pin.";
  }
};

const initializeHospitalMap = async () => {
  if (!mapEl) return false;
  if (mapInitialized && hospitalMap) return true;

  setMapStatus("Loading", "badge-blue");

  try {
    if (!window.ArogyaMap) {
      setTimeout(initializeHospitalMap, 300);
      return false;
    }

    hospitalMap = window.ArogyaMap.initMap(mapEl.id || "admin-hospital-map", {
      lat: DEFAULT_CENTER.lat,
      lng: DEFAULT_CENTER.lng,
      zoom: 12
    });

    if (!hospitalMap) {
      setMapStatus("Map Error", "badge-red");
      return false;
    }

    hospitalMap.on("click", async (event) => {
      const coords = { lat: event.latlng.lat, lng: event.latlng.lng };
      const address = await reverseGeocode(coords);
      setHospitalLocation(coords, address || hospitalAddressInputEl?.value || "");
    });

    mapInitialized = true;
    setMapStatus("OpenStreetMap Ready", "badge-green");
    if (mapHelpEl) {
      mapHelpEl.textContent = "100% Free OpenStreetMap & Leaflet active. Click on map to set location.";
    }

    return true;
  } catch (error) {
    setMapStatus("Map Error", "badge-red");
    mapHelpEl.textContent = error.message || "Unable to initialize Leaflet Map";
    return false;
  }
};

window.reloadAdmins = async function reloadAdmins() {
  try {
    await loadAdmins();
    toast("Hospital admin list refreshed", "success");
  } catch (error) {
    toast(error.message, "error");
  }
};

window.openAdminModal = async function openAdminModal() {
  if (modalEl) modalEl.classList.remove("hidden");
  const ready = await initializeHospitalMap();
  if (!ready || !hospitalMap) return;

  window.setTimeout(() => {
    hospitalMap.invalidateSize();
    if (hospitalCoordinates) {
      hospitalMap.setView([hospitalCoordinates.lat, hospitalCoordinates.lng], 15);
    }
  }, 100);
};

window.closeAdminModal = function closeAdminModal() {
  if (modalEl) modalEl.classList.add("hidden");
  if (formEl) formEl.reset();
  resetHospitalLocation({ clearAddress: true });
};

const createHospitalAdmin = async () => {
  const payload = {
    name: String(document.getElementById("admin-name")?.value || "").trim(),
    phone: String(document.getElementById("admin-phone")?.value || "").trim(),
    hospitalName: String(document.getElementById("admin-hospital")?.value || "").trim(),
    hospitalAddress: String(document.getElementById("admin-hospital-address")?.value || "").trim(),
    hospitalCoordinates,
    email: String(document.getElementById("admin-email")?.value || "").trim(),
    password: String(document.getElementById("admin-password")?.value || ""),
    accessLevel: "full"
  };

  if (!payload.name || !payload.hospitalName || !payload.hospitalAddress) {
    throw new Error("Base name, hospital name and hospital address are required");
  }

  if (!payload.email || !payload.password) {
    throw new Error("Admin login email and password are required");
  }

  await apiRequest("/api/admin/admins", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

const deleteHospital = async (hospitalName) => {
  const name = String(hospitalName || "").trim();
  if (!name) {
    throw new Error("Hospital name is required for deletion");
  }

  return apiRequest("/api/admin/hospitals", {
    method: "DELETE",
    body: JSON.stringify({ hospitalName: name })
  });
};

const findHospitalGroupByKey = (groupKey = "") =>
  groupedHospitalAdmins.find((item) => String(item.groupKey || "") === String(groupKey || "")) || null;

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (modalEl) {
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) window.closeAdminModal();
    });
  }

  if (hospitalIdsModalEl) {
    hospitalIdsModalEl.addEventListener("click", (event) => {
      if (event.target === hospitalIdsModalEl) window.closeHospitalIdsModal();
    });
  }

  if (hospitalEditModalEl) {
    hospitalEditModalEl.addEventListener("click", (event) => {
      if (event.target === hospitalEditModalEl) window.closeHospitalEditModal();
    });
  }

  if (adminPasswordModalEl) {
    adminPasswordModalEl.addEventListener("click", (event) => {
      if (event.target === adminPasswordModalEl) window.closeAdminPasswordModal();
    });
  }

  if (formEl) {
    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitBtnEl) {
        submitBtnEl.disabled = true;
        submitBtnEl.textContent = "Creating Hospital...";
      }

      try {
        await createHospitalAdmin();
        toast("Hospital Admin ID created successfully", "success");
        window.closeAdminModal();
        await loadAdmins();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        if (submitBtnEl) {
          submitBtnEl.disabled = false;
          submitBtnEl.textContent = "Create Hospital Admin ID";
        }
      }
    });
  }

  if (hospitalEditFormEl) {
    hospitalEditFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();

      const hospitalGroup = findHospitalGroupByKey(selectedHospitalGroupKey);
      if (!hospitalGroup) {
        toast("Hospital context missing. Please reopen edit modal.", "error");
        return;
      }

      const currentHospitalName = String(currentHospitalNameEditEl?.value || "").trim();
      const hospitalName = String(hospitalNameEditEl?.value || "").trim();
      const hospitalAddress = String(hospitalAddressEditEl?.value || "").trim();

      let hospitalCoordinates;
      try {
        hospitalCoordinates = normalizeCoordsInput(hospitalLatEditEl?.value, hospitalLngEditEl?.value);
      } catch (error) {
        toast(error.message, "error");
        return;
      }

      if (!hospitalName) {
        toast("Hospital name is required", "error");
        return;
      }

      if (updateHospitalBtnEl) {
        updateHospitalBtnEl.disabled = true;
        updateHospitalBtnEl.textContent = "Updating...";
      }

      try {
        await updateHospitalDetails({
          currentHospitalName,
          hospitalName,
          hospitalAddress,
          hospitalCoordinates
        });
        toast("Hospital details updated successfully", "success");
        window.closeHospitalEditModal();
        await loadAdmins();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        if (updateHospitalBtnEl) {
          updateHospitalBtnEl.disabled = false;
          updateHospitalBtnEl.textContent = "Update Hospital";
        }
      }
    });
  }

  if (adminPasswordFormEl) {
    adminPasswordFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const adminId = String(selectedAdminIdForPassword || "").trim();
      if (!adminId) {
        toast("Admin context missing. Please reopen password modal.", "error");
        return;
      }

      const password = String(newAdminPasswordEl?.value || "");
      const confirm = String(confirmAdminPasswordEl?.value || "");
      if (!password || password.length < 6) {
        toast("Password must be at least 6 characters", "error");
        return;
      }
      if (password !== confirm) {
        toast("Password confirmation does not match", "error");
        return;
      }

      if (updateAdminPasswordBtnEl) {
        updateAdminPasswordBtnEl.disabled = true;
        updateAdminPasswordBtnEl.textContent = "Updating...";
      }

      try {
        await updateAdminPassword({ adminId, password });
        toast("Admin password updated successfully", "success");
        window.closeAdminPasswordModal();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        if (updateAdminPasswordBtnEl) {
          updateAdminPasswordBtnEl.disabled = false;
          updateAdminPasswordBtnEl.textContent = "Update Password";
        }
      }
    });
  }

  if (adminsTbodyEl) {
    adminsTbodyEl.addEventListener("click", async (event) => {
      const viewButton = event.target.closest('button[data-action="view-hospital-ids"]');
      if (viewButton) {
        const encodedGroupKey = viewButton.getAttribute("data-group-key") || "";
        const groupKey = decodeURIComponent(encodedGroupKey);
        const hospitalGroup = groupedHospitalAdmins.find((item) => item.groupKey === groupKey);
        if (!hospitalGroup) {
          toast("Unable to load hospital IDs. Please refresh.", "error");
          return;
        }
        openHospitalIdsModal(hospitalGroup);
        return;
      }

      const editHospitalBtn = event.target.closest('button[data-action="edit-hospital"]');
      if (editHospitalBtn) {
        const encodedGroupKey = editHospitalBtn.getAttribute("data-group-key") || "";
        const groupKey = decodeURIComponent(encodedGroupKey);
        const hospitalGroup = findHospitalGroupByKey(groupKey);
        if (!hospitalGroup) {
          toast("Unable to load hospital details. Please refresh.", "error");
          return;
        }
        openHospitalEditModal(hospitalGroup);
        return;
      }

      const button = event.target.closest('button[data-action="delete-hospital"]');
      if (!button) return;

      const encodedName = button.getAttribute("data-hospital") || "";
      const hospitalName = decodeURIComponent(encodedName).trim();
      if (!hospitalName) {
        toast("Hospital name is missing", "error");
        return;
      }

      const confirmed = window.confirm(
        `Delete hospital \"${hospitalName}\"?\nThis will delete all admin IDs and doctor IDs for this hospital.`
      );
      if (!confirmed) return;

      const previousLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Deleting...";

      try {
        const response = await deleteHospital(hospitalName);
        toast(response.message || "Hospital deleted successfully", "success");
        await loadAdmins();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = previousLabel;
      }
    });
  }

  if (hospitalIdsListEl) {
    hospitalIdsListEl.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="update-admin-password"]');
      if (!button) return;

      const encodedAdminId = button.getAttribute("data-admin-id") || "";
      const adminId = decodeURIComponent(encodedAdminId);
      const admin = admins.find((item) => String(item._id || item.id || "") === adminId);
      if (!admin) {
        toast("Admin record not found. Please refresh.", "error");
        return;
      }
      openAdminPasswordModal(admin);
    });
  }

  if (addressSearchBtnEl) {
    addressSearchBtnEl.addEventListener("click", async () => {
      try {
        await locateAddressOnMap();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  if (hospitalAddressInputEl) {
    hospitalAddressInputEl.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      try {
        await locateAddressOnMap();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  try {
    await loadAdmins();
  } catch (error) {
    toast(error.message, "error");
    renderAdmins([]);
  }
};

init();
