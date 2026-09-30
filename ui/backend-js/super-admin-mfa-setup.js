import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("mfa-setup.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Multi-Factor Auth (2FA)");

let mfaEnabled = true;
let totpVerified = false;

const updateMFABadge = (enabled) => {
  mfaEnabled = enabled;
  const badge = document.getElementById("mfa-status-badge");
  const desc = document.getElementById("mfa-status-desc");

  if (badge) {
    if (enabled) {
      badge.className = "badge badge-green";
      badge.textContent = "🟢 MFA Active";
    } else {
      badge.className = "badge badge-red";
      badge.textContent = "🔴 MFA Disabled";
    }
  }

  if (desc) {
    desc.textContent = enabled
      ? "Your account is protected with 2-Step Authenticator Verification."
      : "Two-step authentication is currently disabled. Enable it to secure your portal.";
  }
};

const updateTOTPUI = (isVerified) => {
  totpVerified = isVerified;
  const setupBox = document.getElementById("totp-setup-box");
  const verifiedBadge = document.getElementById("totp-verified-badge");

  if (setupBox && verifiedBadge) {
    if (isVerified) {
      setupBox.style.display = "none";
      verifiedBadge.style.display = "block";
    } else {
      setupBox.style.display = "flex";
      verifiedBadge.style.display = "none";
    }
  }
};

const loadMfaStatus = async () => {
  try {
    const res = await apiRequest("/api/auth/mfa/status");
    if (res.success) {
      updateMFABadge(res.mfaEnabled);
      updateTOTPUI(Boolean(res.totpVerified));
    }
  } catch (err) {
    console.warn("Could not load MFA status:", err);
  }

  try {
    const totpRes = await apiRequest("/api/auth/mfa/totp-setup");
    if (totpRes.success) {
      const qrContainer = document.getElementById("totp-qr-container");
      const secretCode = document.getElementById("totp-secret-code");
      if (qrContainer && totpRes.qrCodeUrl) {
        qrContainer.innerHTML = `<img src="${totpRes.qrCodeUrl}" alt="2FA QR Code" style="width:140px;height:140px;border-radius:8px">`;
      }
      if (secretCode && totpRes.secret) {
        secretCode.textContent = totpRes.secret;
      }
    }
  } catch (err) {
    console.warn("Could not load TOTP setup QR code:", err);
  }
};

const setupTOTPVerification = () => {
  const verifyBtn = document.getElementById("verify-totp-btn");
  const input = document.getElementById("totp-verify-input");

  if (verifyBtn && input) {
    verifyBtn.addEventListener("click", async () => {
      const code = input.value.trim();
      if (code.length !== 6 || !/^\d+$/.test(code)) {
        toast("Please enter a valid 6-digit numeric authenticator code", "warn");
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.textContent = "Verifying...";

      try {
        const res = await apiRequest("/api/auth/mfa/verify-totp", {
          method: "POST",
          body: JSON.stringify({ code })
        });

        if (res.success) {
          toast("Authenticator TOTP code verified and activated!", "success");
          input.value = "";
          updateMFABadge(true);
          updateTOTPUI(true);
        }
      } catch (err) {
        toast(err.message || "Failed to verify TOTP code", "error");
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Verify & Activate";
      }
    });
  }
};

const setupRecoveryCodes = () => {
  const downloadBtn = document.getElementById("download-recovery-codes-btn");
  const generateBtn = document.getElementById("generate-new-codes-btn");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const chips = document.querySelectorAll(".recovery-code-chip");
      const codes = Array.from(chips).map((chip) => chip.textContent).join("\n");
      const blob = new Blob([`Arogya Plus Emergency Recovery Backup Codes:\n\n${codes}\n\nKeep these codes in a safe place.`], {
        type: "text/plain"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "arogya_plus_mfa_backup_codes.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast("Emergency recovery codes saved to file", "success");
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const grid = document.getElementById("backup-codes-grid");
      if (!grid) return;

      grid.innerHTML = Array.from({ length: 6 })
        .map(() => {
          const rand = () => Math.floor(Math.random() * 8999 + 1000);
          return `<div class="recovery-code-chip">${rand()}-${rand()}</div>`;
        })
        .join("");

      toast("New emergency backup codes generated", "success");
    });
  }
};

const setupGlobalToggle = () => {
  const toggleBtn = document.getElementById("toggle-mfa-global-btn");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", async () => {
    const nextState = !mfaEnabled;
    updateMFABadge(nextState);

    try {
      const res = await apiRequest("/api/auth/mfa/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled: nextState })
      });

      if (res.success) {
        toast(`Multi-Factor Authentication ${nextState ? "Enabled" : "Disabled"}`, nextState ? "success" : "info");
      }
    } catch (err) {
      console.warn("MFA state toggle error:", err);
    }
  });
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin", "admin"],
    onDenied: () => toast("Please login to access MFA setup", "error")
  });
  if (!session.allowed) return;

  setupTOTPVerification();
  setupRecoveryCodes();
  setupGlobalToggle();
  await loadMfaStatus();
};

init();
