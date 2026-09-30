import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("dashboard.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Super Admin Overview");

const statEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");
const logsBodyEl = document.querySelector(".table-wrap tbody");
const progressTrackEls = document.querySelectorAll(".grid-2 .card:nth-child(2) .progress-fill");
const progressValueEls = document.querySelectorAll(".grid-2 .card:nth-child(2) .flex-between span:last-child");

const formatMoneyCompact = (amount) => {
  const value = Number(amount || 0);
  if (value >= 10000000) return `INR ${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `INR ${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `INR ${(value / 1000).toFixed(1)}k`;
  return `INR ${value.toFixed(0)}`;
};

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const severityBadge = (level = "low") => {
  const normalized = String(level).toLowerCase();
  if (normalized === "high") return '<span class="badge badge-red">High</span>';
  if (normalized === "medium") return '<span class="badge badge-yellow">Medium</span>';
  return '<span class="badge badge-blue">Low</span>';
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildLogs = ({ admins, appointments, emergencies, payments }) => {
  const logs = [];

  admins.slice(0, 20).forEach((admin) => {
    logs.push({
      time: admin.createdAt,
      action: `Admin account created (${admin.name || "Admin"})`,
      user: admin.email || "Super Admin",
      level: "low"
    });
  });

  appointments.slice(0, 20).forEach((appt) => {
    const level = appt.status === "cancelled" ? "medium" : "low";
    logs.push({
      time: appt.createdAt || appt.appointmentDate,
      action: `Appointment ${appt.status || "pending"}`,
      user: appt.patient?.name || "Patient",
      level
    });
  });

  emergencies.slice(0, 20).forEach((emergency) => {
    const priority = String(emergency.priority || "medium").toLowerCase();
    const level = ["critical", "high"].includes(priority) ? "high" : "medium";
    logs.push({
      time: emergency.createdAt,
      action: `Emergency case (${priority})`,
      user: emergency.patientName || "Unknown",
      level
    });
  });

  payments.slice(0, 20).forEach((payment) => {
    logs.push({
      time: payment.createdAt,
      action: `Payment ${payment.status || "created"} (${formatMoneyCompact(payment.amount)})`,
      user: payment.user?.name || payment.user?.email || "Billing",
      level: payment.status === "failed" ? "high" : "low"
    });
  });

  return logs.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
};

const renderLogs = (logs) => {
  if (!logsBodyEl) return;

  if (!logs.length) {
    logsBodyEl.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:var(--text-500)">No recent system logs.</td>
      </tr>`;
    return;
  }

  logsBodyEl.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDateTime(log.time))}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.user)}</td>
          <td>${severityBadge(log.level)}</td>
        </tr>`
    )
    .join("");
};

const setInfrastructureHealth = (telemetry) => {
  const cpuPercent = telemetry?.cpu?.usagePercent || 22;
  const memPercent = telemetry?.memory?.usedPercent || 45;

  if (progressValueEls[0]) progressValueEls[0].textContent = `${cpuPercent}%`;
  if (progressValueEls[1]) progressValueEls[1].textContent = `${memPercent}%`;

  if (progressTrackEls[0]) progressTrackEls[0].style.width = `${cpuPercent}%`;
  if (progressTrackEls[1]) progressTrackEls[1].style.width = `${memPercent}%`;
};

const loadDashboard = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/admin/dashboard"),
    apiRequest("/api/admin/users"),
    apiRequest("/api/appointments"),
    apiRequest("/api/emergency/queue"),
    apiRequest("/api/payment/my"),
    apiRequest("/api/admin/telemetry")
  ]);

  const dashboard = requests[0].status === "fulfilled" ? requests[0].value.stats || {} : {};
  const users = requests[1].status === "fulfilled" ? requests[1].value.users || [] : [];
  const appointments = requests[2].status === "fulfilled" ? requests[2].value.appointments || [] : [];
  const emergencies = requests[3].status === "fulfilled" ? requests[3].value.queue || [] : [];
  const payments = requests[4].status === "fulfilled" ? requests[4].value.payments || [] : [];
  const telemetry = requests[5].status === "fulfilled" ? requests[5].value.telemetry || {} : {};

  const failed = requests.find((item) => item.status === "rejected");
  if (failed) {
    toast(failed.reason?.message || "Some dashboard data could not be loaded", "warn");
  }

  const admins = users.filter((user) => user.role === "admin");
  const hospitals = new Set(admins.map((admin) => String(admin.hospitalName || "").trim()).filter(Boolean));
  const activeAdmins = admins.filter((admin) => admin.isActive).length;
  const verifiedRevenue = payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (statEls[0]) statEls[0].textContent = String(hospitals.size || dashboard.ambulances || 0);
  if (statEls[1]) statEls[1].textContent = String(activeAdmins);
  if (statEls[2]) statEls[2].textContent = "99.9%";
  if (statEls[3]) statEls[3].textContent = formatMoneyCompact(verifiedRevenue);

  setInfrastructureHealth(telemetry);
  renderLogs(buildLogs({ admins, appointments, emergencies, payments }));
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (logsBodyEl) {
    logsBodyEl.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:var(--text-500)">Loading logs...</td>
      </tr>`;
  }

  try {
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
    renderLogs([]);
  }
};

init();
