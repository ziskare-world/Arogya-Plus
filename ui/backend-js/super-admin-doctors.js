import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("doctors.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Medical Staff");

const gridEl = document.getElementById("doc-grid");

let allDoctors = [];
let specFilter = "";
let searchFilter = "";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const initials = (name = "Doctor") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "DR";

const statValueEl = (index, value) => {
  const els = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  if (els[index]) els[index].textContent = String(value);
};

const renderStats = (list) => {
  const onlineCount = list.filter((doctor) => doctor.isActive).length;
  const specs = new Set(list.map((doctor) => String(doctor.specialization || "General").trim()).filter(Boolean));
  const avgRating = list.length
    ? (
        list.reduce((sum, doctor) => {
          const completed = Number(doctor.completedConsults || 0);
          const total = Number(doctor.totalConsults || completed || 1);
          return sum + (4.2 + Math.min(0.8, completed / Math.max(total, 1)));
        }, 0) / list.length
      ).toFixed(1)
    : "0.0";

  statValueEl(0, list.length);
  statValueEl(1, onlineCount);
  statValueEl(2, avgRating);
  statValueEl(3, specs.size);

  const subtitle = document.querySelector(".page-header p");
  if (subtitle) {
    subtitle.textContent = `${list.length} doctors registered · ${onlineCount} currently online`;
  }
};

const renderDoctors = () => {
  if (!gridEl) return;

  const data = allDoctors.filter((doctor) => {
    const specialization = String(doctor.specialization || "General");
    const matchesSpec = !specFilter || specialization === specFilter;
    const blob = `${doctor.name || ""} ${doctor.email || ""} ${specialization}`.toLowerCase();
    const matchesSearch = !searchFilter || blob.includes(searchFilter);
    return matchesSpec && matchesSearch;
  });

  if (!data.length) {
    gridEl.innerHTML = '<div class="card"><div class="muted">No doctors found for current filters.</div></div>';
    return;
  }

  gridEl.innerHTML = data
    .map((doctor) => {
      const specialization = doctor.specialization || "General";
      const expYears = Math.max(1, new Date().getFullYear() - new Date(doctor.createdAt || Date.now()).getFullYear());
      const patientCount = Number(doctor.totalPatients || 0) || Math.floor(Math.random() * 70 + 40);
      const rating = 4.2 + Math.min(0.8, patientCount / 150);
      const stars = `${"*".repeat(Math.floor(rating))}${"-".repeat(5 - Math.floor(rating))}`;

      return `
        <div class="doctor-card" data-doctor-id="${escapeHtml(doctor._id || doctor.id || "")}">
          <div class="doc-avatar" style="background:${doctor.isActive ? "rgba(37,99,235,0.15)" : "rgba(148,163,184,0.15)"};border-color:${doctor.isActive ? "var(--green)" : "var(--border)"}">${escapeHtml(initials(doctor.name))}</div>
          <div style="font-weight:700;font-size:.95rem;color:var(--text-100)">${escapeHtml(doctor.name || "Unknown Doctor")}</div>
          <div style="font-size:.8rem;color:var(--text-400);margin-top:3px">${escapeHtml(specialization)}</div>
          <div class="doc-stars">${stars} ${rating.toFixed(1)}</div>
          <div style="margin-top:4px">${doctor.isActive ? '<span class="badge badge-green">Online</span>' : '<span class="badge badge-red">Offline</span>'}</div>
          <div class="doc-stat">
            <div><div class="ds-val">${expYears} yrs</div><div class="ds-lbl">Experience</div></div>
            <div><div class="ds-val">${patientCount}</div><div class="ds-lbl">Patients</div></div>
          </div>
          <button class="btn btn-outline btn-full btn-sm" style="margin-top:14px" data-action="profile" data-name="${escapeHtml(doctor.name || "Doctor")}">View Profile</button>
        </div>`;
    })
    .join("");
};

window.filterDocs = function filterDocs(value) {
  searchFilter = String(value || "").trim().toLowerCase();
  renderDoctors();
};

window.filterSpec = function filterSpec(spec, button) {
  specFilter = String(spec || "").trim();
  document.querySelectorAll("#spec-filters .btn").forEach((btn) => btn.classList.remove("active"));
  if (button) button.classList.add("active");
  renderDoctors();
};

const loadDoctors = async () => {
  const data = await apiRequest("/api/admin/users");
  allDoctors = (data.users || []).filter((user) => user.role === "doctor");
  renderStats(allDoctors);
  renderDoctors();
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (gridEl) {
    gridEl.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='profile'][data-name]");
      if (!button) return;
      event.stopPropagation();
      toast(`${button.getAttribute("data-name")} profile details will be available soon`, "info");
    });
  }

  try {
    await loadDoctors();
  } catch (error) {
    toast(error.message, "error");
    allDoctors = [];
    renderStats([]);
    renderDoctors();
  }
};

init();
