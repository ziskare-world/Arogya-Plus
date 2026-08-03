import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("settings.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Super Admin Settings");

const setupFormListeners = () => {
  const netForm = document.getElementById("settings-network-form");
  const secForm = document.getElementById("settings-security-form");
  const storForm = document.getElementById("settings-storage-form");

  if (netForm) {
    netForm.addEventListener("submit", (e) => {
      e.preventDefault();
      toast("Hospital network preferences saved successfully", "success");
    });
  }

  if (secForm) {
    secForm.addEventListener("submit", (e) => {
      e.preventDefault();
      toast("Security and session policies updated", "success");
    });
  }

  if (storForm) {
    storForm.addEventListener("submit", (e) => {
      e.preventDefault();
      toast("Storage quotas and cleanup preferences updated", "success");
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
};

init();
