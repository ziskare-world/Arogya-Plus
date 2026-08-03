import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("settings.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Super Admin Settings");

let currentSettings = {};

const populateForms = (settings = {}) => {
  currentSettings = settings;

  // Security Controls
  const sessionTimeout = document.getElementById("setting-session-timeout");
  const rateLimit = document.getElementById("setting-rate-limit");
  const require2FA = document.getElementById("setting-2fa");
  const maxLoginAttempts = document.getElementById("setting-max-login-attempts");
  const ipRestriction = document.getElementById("setting-ip-restriction");

  if (sessionTimeout) sessionTimeout.value = settings.sessionTimeout || "24h";
  if (rateLimit) rateLimit.value = settings.rateLimitPolicy || "strict";
  if (require2FA) require2FA.value = String(Boolean(settings.require2FA));
  if (maxLoginAttempts) maxLoginAttempts.value = String(settings.maxLoginAttempts || 5);
  if (ipRestriction) ipRestriction.value = String(Boolean(settings.ipRestrictedAccess));

  // Accessibility Controls
  const highContrast = document.getElementById("setting-high-contrast");
  const fontScale = document.getElementById("setting-font-scale");
  const reducedMotion = document.getElementById("setting-reduced-motion");
  const screenReader = document.getElementById("setting-screen-reader");

  if (highContrast) highContrast.value = String(Boolean(settings.highContrastMode));
  if (fontScale) fontScale.value = settings.fontSizeScale || "standard";
  if (reducedMotion) reducedMotion.value = String(Boolean(settings.reducedMotion));
  if (screenReader) screenReader.value = String(Boolean(settings.screenReaderOptimized));

  // Network & Storage
  const currency = document.getElementById("setting-default-currency");
  const autoApproval = document.getElementById("setting-auto-approval");
  const platformTitle = document.getElementById("setting-platform-title");
  const storageQuota = document.getElementById("setting-storage-quota");

  if (currency) currency.value = settings.defaultCurrency || "INR";
  if (autoApproval) autoApproval.value = settings.hospitalAutoApproval || "manual";
  if (platformTitle) platformTitle.value = settings.platformTitle || "Arogya Plus Healthcare Platform";
  if (storageQuota) storageQuota.value = settings.defaultStorageQuota || "5GB";

  applyAccessibilityEffects(settings);
};

const applyAccessibilityEffects = (settings) => {
  if (settings.highContrastMode) {
    document.body.classList.add("high-contrast");
  } else {
    document.body.classList.remove("high-contrast");
  }

  if (settings.reducedMotion) {
    document.body.classList.add("reduced-motion");
  } else {
    document.body.classList.remove("reduced-motion");
  }

  if (settings.fontSizeScale === "medium") {
    document.documentElement.style.fontSize = "17px";
  } else if (settings.fontSizeScale === "large") {
    document.documentElement.style.fontSize = "19px";
  } else {
    document.documentElement.style.fontSize = "16px";
  }
};

const loadSettings = async () => {
  try {
    const res = await apiRequest("/api/admin/settings");
    if (res.success && res.settings) {
      populateForms(res.settings);
    }
  } catch (err) {
    toast(err.message || "Failed to load system settings", "error");
  }
};

const saveSettings = async (payload, successMsg) => {
  try {
    const res = await apiRequest("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (res.success && res.settings) {
      populateForms(res.settings);
      toast(successMsg || "Settings saved successfully", "success");
    }
  } catch (err) {
    toast(err.message || "Failed to save settings", "error");
  }
};

const setupFormListeners = () => {
  const secForm = document.getElementById("settings-security-form");
  const accForm = document.getElementById("settings-accessibility-form");
  const netForm = document.getElementById("settings-network-form");

  if (secForm) {
    secForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        sessionTimeout: document.getElementById("setting-session-timeout").value,
        rateLimitPolicy: document.getElementById("setting-rate-limit").value,
        require2FA: document.getElementById("setting-2fa").value === "true",
        maxLoginAttempts: Number(document.getElementById("setting-max-login-attempts").value),
        ipRestrictedAccess: document.getElementById("setting-ip-restriction").value === "true"
      };
      await saveSettings(payload, "Security policies saved successfully");
    });
  }

  if (accForm) {
    accForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        highContrastMode: document.getElementById("setting-high-contrast").value === "true",
        fontSizeScale: document.getElementById("setting-font-scale").value,
        reducedMotion: document.getElementById("setting-reduced-motion").value === "true",
        screenReaderOptimized: document.getElementById("setting-screen-reader").value === "true"
      };
      await saveSettings(payload, "Accessibility & UI settings saved successfully");
    });
  }

  if (netForm) {
    netForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        defaultCurrency: document.getElementById("setting-default-currency").value,
        hospitalAutoApproval: document.getElementById("setting-auto-approval").value,
        platformTitle: document.getElementById("setting-platform-title").value.trim(),
        defaultStorageQuota: document.getElementById("setting-storage-quota").value
      };
      await saveSettings(payload, "Hospital network and storage preferences saved");
    });
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  setupFormListeners();
  await loadSettings();
};

init();
