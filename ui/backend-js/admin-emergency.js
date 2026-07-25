import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

injectSidebar("emergency.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Emergency Queue");

const queueListEl = document.getElementById("queue-list");
const resolvedListEl = document.getElementById("resolved-list");
const emergencyCountEl = document.getElementById("emr-count");
const resolvedStoreKey = "admin_emergency_resolved_cases";

let queue = [];
let resolvedCases = [];
let addPatientModalEl = null;
let addPatientFormEl = null;
let addPatientSubmitEl = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const parseJson = (value) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const toTitle = (value = "") => {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const relativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const priorityClass = (priority = "") => {
  const normalized = String(priority).toLowerCase();
  if (normalized === "critical") return "q-critical";
  if (normalized === "high") return "q-urgent";
  return "q-stable";
};

const badgeClass = (priority = "") => {
  const normalized = String(priority).toLowerCase();
  if (normalized === "critical") return "badge badge-red";
  if (normalized === "high") return "badge badge-yellow";
  if (normalized === "medium") return "badge badge-cyan";
  return "badge badge-green";
};

const todayString = () => new Date().toISOString().slice(0, 10);

const saveResolvedCases = () => {
  sessionStorage.setItem(resolvedStoreKey, JSON.stringify(resolvedCases.slice(0, 40)));
};

const loadResolvedCases = () => {
  resolvedCases = parseJson(sessionStorage.getItem(resolvedStoreKey));
};

const syncStats = () => {
  if (emergencyCountEl) emergencyCountEl.textContent = String(queue.length);

  const statEls = document.querySelectorAll(".grid-4 .stat-card .stat-value");
  const today = todayString();
  const queueToday = queue.filter((item) => String(item.createdAt || "").slice(0, 10) === today).length;
  const resolvedToday = resolvedCases.filter((item) => String(item.resolvedAt || "").slice(0, 10) === today).length;
  const totalToday = queueToday + resolvedToday;

  const responseMinutes = queue.length
    ? Math.max(
        1,
        Math.round(
          queue.reduce((sum, item) => {
            const created = new Date(item.createdAt).getTime();
            if (!created) return sum;
            return sum + (Date.now() - created) / (60 * 1000);
          }, 0) / queue.length
        )
      )
    : 0;

  if (statEls[0]) statEls[0].textContent = String(queue.length);
  if (statEls[1]) statEls[1].textContent = String(totalToday);
  if (statEls[2]) statEls[2].textContent = String(resolvedToday);
  if (statEls[3]) statEls[3].textContent = responseMinutes ? `~${responseMinutes}m` : "~0m";

  const resolvedBadge = document.querySelector(".grid-2 .card .card-header .badge");
  if (resolvedBadge) {
    resolvedBadge.textContent = `${resolvedToday} cases`;
  }
};

const renderQueue = () => {
  if (!queueListEl) return;

  if (!queue.length) {
    queueListEl.innerHTML = '<div class="card"><div class="muted">No active emergency case in queue.</div></div>';
    return;
  }

  queueListEl.innerHTML = queue
    .map((item, index) => {
      const symptoms = Array.isArray(item.symptoms) ? item.symptoms.filter(Boolean) : [];
      const condition = symptoms.length ? symptoms.join(", ") : "Emergency case";
      const level = toTitle(item.priority || "medium");
      const hr = 72 + ((index + 3) * 7) % 40;
      const spo2 = 88 + ((index + 5) * 3) % 10;
      const bp = `${110 + ((index + 1) % 4) * 10}/${70 + ((index + 2) % 3) * 10}`;

      return `
        <div class="queue-card">
          <div class="queue-num ${priorityClass(item.priority)}">${index + 1}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <span style="font-weight:700">${escapeHtml(item.patientName || "Unknown Patient")}</span>
              <span style="font-size:.72rem;color:var(--text-500)">EMR-${escapeHtml(String(item._id || "").slice(-6).toUpperCase())}</span>
              <span class="${badgeClass(item.priority)}">${escapeHtml(level)}</span>
            </div>
            <div style="font-size:.8rem;color:var(--text-400)">${escapeHtml(condition)}</div>
            <div style="display:flex;gap:16px;margin-top:8px">
              <div class="vital-mini"><div class="vm-val">${hr}</div><div class="vm-lbl">HR bpm</div></div>
              <div class="vital-mini"><div class="vm-val">${bp}</div><div class="vm-lbl">BP</div></div>
              <div class="vital-mini"><div class="vm-val">${spo2}%</div><div class="vm-lbl">SPO2</div></div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="font-size:.72rem;color:var(--text-500)">${escapeHtml(relativeTime(item.createdAt))}</div>
            <button class="btn btn-success btn-sm" onclick="resolve(${index})">Resolve</button>
            <button class="btn btn-outline btn-sm" onclick="assignCase(${index})">Assign</button>
          </div>
        </div>`;
    })
    .join("");
};

const renderResolved = () => {
  if (!resolvedListEl) return;

  if (!resolvedCases.length) {
    resolvedListEl.innerHTML = '<div class="muted" style="padding:6px 0">No resolved cases yet.</div>';
    return;
  }

  resolvedListEl.innerHTML = resolvedCases
    .slice(0, 10)
    .map(
      (item) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:.85rem;font-weight:500">${escapeHtml(item.patientName || "Unknown Patient")}</div>
            <div style="font-size:.72rem;color:var(--text-500)">${escapeHtml(item.condition || "Emergency case")}</div>
          </div>
          <div style="text-align:right">
            <span class="badge badge-green">Resolved</span>
            <div style="font-size:.68rem;color:var(--text-500);margin-top:3px">${escapeHtml(
              new Date(item.resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            )}</div>
          </div>
        </div>`
    )
    .join("");
};

const renderAll = () => {
  renderQueue();
  renderResolved();
  syncStats();
};

const loadQueue = async () => {
  if (queueListEl) {
    queueListEl.innerHTML = '<div class="muted">Loading emergency queue...</div>';
  }
  const data = await apiRequest("/api/emergency/queue");
  queue = data.queue || [];
  renderAll();
};

const closeAddPatientModal = () => {
  if (!addPatientModalEl) return;
  addPatientModalEl.style.display = "none";
  if (addPatientFormEl) addPatientFormEl.reset();
};

const ensureAddPatientModal = () => {
  if (addPatientModalEl) return;

  const modal = document.createElement("div");
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(2,6,23,.56);display:none;align-items:center;justify-content:center;z-index:1300;padding:16px;";

  modal.innerHTML = `
    <div style="width:min(560px,96vw);background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h3 style="margin:0;color:var(--text-100);font-size:1.02rem;">Add Emergency Patient</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="add-patient-close" style="padding:6px 10px;line-height:1;">x</button>
      </div>
      <form id="add-patient-form" style="display:grid;gap:12px;">
        <div class="form-group">
          <label class="form-label" for="ep-patient-name">Patient Name</label>
          <input id="ep-patient-name" class="form-input" type="text" required />
        </div>
        <div class="grid-2" style="gap:12px;">
          <div class="form-group">
            <label class="form-label" for="ep-contact">Contact Number</label>
            <input id="ep-contact" class="form-input" type="text" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-priority">Priority</label>
            <select id="ep-priority" class="form-input">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="ep-location">Location / Ward</label>
          <input id="ep-location" class="form-input" type="text" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="ep-symptoms">Symptoms (comma separated)</label>
          <input id="ep-symptoms" class="form-input" type="text" placeholder="Chest pain, breathlessness" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;">
          <button type="button" class="btn btn-outline" id="add-patient-cancel">Cancel</button>
          <button type="submit" class="btn btn-danger" id="add-patient-submit">Add to Queue</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);
  addPatientModalEl = modal;
  addPatientFormEl = modal.querySelector("#add-patient-form");
  addPatientSubmitEl = modal.querySelector("#add-patient-submit");

  const closeBtn = modal.querySelector("#add-patient-close");
  const cancelBtn = modal.querySelector("#add-patient-cancel");

  if (closeBtn) closeBtn.addEventListener("click", closeAddPatientModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeAddPatientModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeAddPatientModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && addPatientModalEl?.style.display === "flex") {
      closeAddPatientModal();
    }
  });

  if (addPatientFormEl) {
    addPatientFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();

      const patientName = String(modal.querySelector("#ep-patient-name")?.value || "").trim();
      const contact = String(modal.querySelector("#ep-contact")?.value || "").trim();
      const location = String(modal.querySelector("#ep-location")?.value || "").trim();
      const priority = String(modal.querySelector("#ep-priority")?.value || "medium").toLowerCase();
      const symptomsRaw = String(modal.querySelector("#ep-symptoms")?.value || "").trim();
      const symptoms = symptomsRaw
        ? symptomsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      if (!patientName || !contact || !location) {
        toast("Patient name, contact and location are required", "error");
        return;
      }

      try {
        if (addPatientSubmitEl) {
          addPatientSubmitEl.disabled = true;
          addPatientSubmitEl.textContent = "Adding...";
        }

        await apiRequest("/api/emergency", {
          method: "POST",
          body: JSON.stringify({
            patientName,
            contact,
            location,
            priority,
            symptoms
          })
        });

        closeAddPatientModal();
        toast(`${patientName} added to emergency queue`, "warn");
        await loadQueue();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        if (addPatientSubmitEl) {
          addPatientSubmitEl.disabled = false;
          addPatientSubmitEl.textContent = "Add to Queue";
        }
      }
    });
  }
};

const openAddPatientModal = () => {
  ensureAddPatientModal();
  if (!addPatientModalEl) return;
  addPatientModalEl.style.display = "flex";
  const firstField = addPatientModalEl.querySelector("#ep-patient-name");
  if (firstField) {
    setTimeout(() => firstField.focus(), 20);
  }
};

window.toast = function emergencyToast(message, type = "info") {
  toast(message, type);
  if (message === "Refreshed") {
    loadQueue().catch(() => {});
  }
};

window.resolve = async function resolve(index) {
  const item = queue[index];
  if (!item?._id) return;

  try {
    await apiRequest(`/api/emergency/${item._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" })
    });
    resolvedCases.unshift({
      id: item._id,
      patientName: item.patientName,
      condition: Array.isArray(item.symptoms) && item.symptoms.length ? item.symptoms.join(", ") : "Emergency case",
      resolvedAt: new Date().toISOString()
    });
    saveResolvedCases();
    toast(`${item.patientName || "Patient"} case resolved`, "success");
    await loadQueue();
  } catch (error) {
    toast(error.message, "error");
  }
};

window.assignCase = async function assignCase(index) {
  const item = queue[index];
  if (!item?._id) return;

  try {
    await apiRequest(`/api/emergency/${item._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" })
    });
    toast("Case assigned for active response", "success");
    await loadQueue();
  } catch (error) {
    toast(error.message, "error");
  }
};

window.addPatient = async function addPatient() {
  openAddPatientModal();
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  loadResolvedCases();
  ensureAddPatientModal();

  try {
    await loadQueue();
  } catch (error) {
    toast(error.message, "error");
    queue = [];
    renderAll();
  }
};

init();

