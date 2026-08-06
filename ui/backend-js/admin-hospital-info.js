import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("hospital-info.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Hospital Profile & Infrastructure Details");

let currentSettings = {};

const updateBadges = (settings = {}) => {
  const totalBeds = Number(settings.totalBeds || 0);
  const occupiedBeds = Number(settings.occupiedBeds || 0);
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const icuTotal = Number(settings.icuBedsTotal || 0);
  const icuOccupied = Number(settings.icuBedsOccupied || 0);

  const pct = totalBeds > 0 ? Math.min(100, Math.max(0, Math.round((occupiedBeds / totalBeds) * 100))) : 0;

  const totalEl = document.getElementById("badge-total-beds");
  const occupiedEl = document.getElementById("badge-occupied-beds");
  const availableEl = document.getElementById("badge-available-beds");
  const icuEl = document.getElementById("badge-icu-beds");
  const pctEl = document.getElementById("badge-occupancy-pct");

  if (totalEl) totalEl.textContent = String(totalBeds);
  if (occupiedEl) occupiedEl.textContent = String(occupiedBeds);
  if (availableEl) availableEl.textContent = String(availableBeds);
  if (icuEl) icuEl.textContent = `${icuOccupied}/${icuTotal}`;
  if (pctEl) pctEl.textContent = `${pct}%`;
};

const populateForms = (settings = {}) => {
  currentSettings = settings;

  // Profile
  const nameEl = document.getElementById("hosp-name");
  const regEl = document.getElementById("hosp-reg-no");
  const phoneEl = document.getElementById("hosp-phone");
  const emailEl = document.getElementById("hosp-email");
  const addressEl = document.getElementById("hosp-address");

  if (nameEl) nameEl.value = settings.hospitalName || "Arogya Central Hospital";
  if (regEl) regEl.value = settings.registrationNumber || "REG-HOSP-2026-001";
  if (phoneEl) phoneEl.value = settings.emergencyContact || "1800-112-999";
  if (emailEl) emailEl.value = settings.hospitalEmail || "contact@arogyaplus.org";
  if (addressEl) addressEl.value = settings.hospitalAddress || "Healthcare Avenue, Medical Enclave";

  // Beds
  const totalBedsEl = document.getElementById("hosp-total-beds");
  const occupiedBedsEl = document.getElementById("hosp-occupied-beds");
  const icuTotalEl = document.getElementById("hosp-icu-total");
  const icuOccupiedEl = document.getElementById("hosp-icu-occupied");
  const vBedsEl = document.getElementById("hosp-ventilators");

  if (totalBedsEl) totalBedsEl.value = settings.totalBeds ?? 0;
  if (occupiedBedsEl) occupiedBedsEl.value = settings.occupiedBeds ?? 0;
  if (icuTotalEl) icuTotalEl.value = settings.icuBedsTotal ?? 0;
  if (icuOccupiedEl) icuOccupiedEl.value = settings.icuBedsOccupied ?? 0;
  if (vBedsEl) vBedsEl.value = settings.ventilatorBeds ?? 0;

  // Facilities
  const otsTotalEl = document.getElementById("hosp-ots-total");
  const otsActiveEl = document.getElementById("hosp-ots-active");
  const ambEl = document.getElementById("hosp-ambulances");
  const bloodEl = document.getElementById("hosp-blood-units");
  const pharmEl = document.getElementById("hosp-pharmacy");

  if (otsTotalEl) otsTotalEl.value = settings.operationTheatres ?? 0;
  if (otsActiveEl) otsActiveEl.value = settings.activeOTs ?? 0;
  if (ambEl) ambEl.value = settings.ambulanceCount ?? 0;
  if (bloodEl) bloodEl.value = settings.bloodBankUnits ?? 0;
  if (pharmEl) pharmEl.value = settings.pharmacyStatus || "24/7 Active";

  updateBadges(settings);
};

const loadHospitalInfo = async () => {
  try {
    const res = await apiRequest("/api/admin/settings");
    if (res.success && res.settings) {
      populateForms(res.settings);
    }
  } catch (err) {
    toast(err.message || "Failed to load hospital details", "error");
  }
};

const saveHospitalInfo = async (payload, successMsg) => {
  try {
    const res = await apiRequest("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (res.success && res.settings) {
      populateForms(res.settings);
      toast(successMsg || "Hospital information saved successfully", "success");
    }
  } catch (err) {
    toast(err.message || "Failed to save hospital information", "error");
  }
};

const setupFormListeners = () => {
  const profileForm = document.getElementById("hospital-info-form");
  const bedsForm = document.getElementById("hospital-beds-form");
  const facilitiesForm = document.getElementById("hospital-facilities-form");
  const refreshBtn = document.getElementById("refresh-hosp-info-btn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadHospitalInfo();
      toast("Hospital details refreshed", "info");
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        hospitalName: document.getElementById("hosp-name").value.trim(),
        registrationNumber: document.getElementById("hosp-reg-no").value.trim(),
        emergencyContact: document.getElementById("hosp-phone").value.trim(),
        hospitalEmail: document.getElementById("hosp-email").value.trim(),
        hospitalAddress: document.getElementById("hosp-address").value.trim()
      };
      await saveHospitalInfo(payload, "Profile and contact details saved successfully");
    });
  }

  if (bedsForm) {
    bedsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        totalBeds: Number(document.getElementById("hosp-total-beds").value || 0),
        occupiedBeds: Number(document.getElementById("hosp-occupied-beds").value || 0),
        icuBedsTotal: Number(document.getElementById("hosp-icu-total").value || 0),
        icuBedsOccupied: Number(document.getElementById("hosp-icu-occupied").value || 0),
        ventilatorBeds: Number(document.getElementById("hosp-ventilators").value || 0)
      };
      await saveHospitalInfo(payload, "Bed capacity and ICU details saved successfully");
    });
  }

  if (facilitiesForm) {
    facilitiesForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        operationTheatres: Number(document.getElementById("hosp-ots-total").value || 0),
        activeOTs: Number(document.getElementById("hosp-ots-active").value || 0),
        ambulanceCount: Number(document.getElementById("hosp-ambulances").value || 0),
        bloodBankUnits: Number(document.getElementById("hosp-blood-units").value || 0),
        pharmacyStatus: document.getElementById("hosp-pharmacy").value
      };
      await saveHospitalInfo(payload, "Emergency facilities updated successfully");
    });
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin", "super-admin"],
    onDenied: () => toast("Please login as hospital admin", "error")
  });
  if (!session.allowed) return;

  setupFormListeners();
  await loadHospitalInfo();
};

init();
