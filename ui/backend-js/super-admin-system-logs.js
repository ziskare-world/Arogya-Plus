import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, downloadTextFile } from "../js/api-client.js";

window.toast = toast;
injectSidebar("system-logs.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("System Logs");

const tableBodyEl = document.querySelector(".table-wrap tbody");
const exportBtnEl = document.querySelector(".page-header .btn.btn-outline");

let currentLogs = [];

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19);
};

const toLevelBadge = (level = "INFO") => {
  const normalized = String(level).toUpperCase();
  if (normalized === "WARN") return '<span class="badge badge-red">WARN</span>';
  if (normalized === "MEDIUM") return '<span class="badge badge-yellow">MEDIUM</span>';
  return '<span class="badge badge-blue">INFO</span>';
};

const buildLogs = ({ users, appointments, emergencies, payments }) => {
  const logs = [];

  users.slice(0, 30).forEach((user) => {
    logs.push({
      timestamp: user.createdAt,
      level: "INFO",
      module: "User Service",
      event: `Account created (${user.role || "user"})`,
      actor: user.email || user.name || "System"
    });
  });

  appointments.slice(0, 30).forEach((appointment) => {
    logs.push({
      timestamp: appointment.updatedAt || appointment.createdAt || appointment.appointmentDate,
      level: appointment.status === "cancelled" ? "WARN" : "INFO",
      module: "Appointments",
      event: `Appointment ${appointment.status || "pending"}`,
      actor: appointment.patient?.name || "Patient"
    });
  });

  emergencies.slice(0, 30).forEach((emergency) => {
    const high = ["critical", "high"].includes(String(emergency.priority || "").toLowerCase());
    logs.push({
      timestamp: emergency.createdAt,
      level: high ? "WARN" : "MEDIUM",
      module: "Emergency",
      event: `Emergency ${emergency.status || "waiting"} (${emergency.priority || "medium"})`,
      actor: emergency.patientName || "Unknown"
    });
  });

  payments.slice(0, 30).forEach((payment) => {
    logs.push({
      timestamp: payment.createdAt,
      level: payment.status === "failed" ? "WARN" : "INFO",
      module: "Billing",
      event: `Payment ${payment.status || "created"} (${Number(payment.amount || 0).toLocaleString("en-IN")})`,
      actor: payment.user?.email || payment.user?.name || "Billing System"
    });
  });

  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 120);
};

const renderLogs = (logs) => {
  if (!tableBodyEl) return;
  if (!logs.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">No logs available.</td>
      </tr>`;
    return;
  }

  tableBodyEl.innerHTML = logs
    .slice(0, 40)
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDateTime(log.timestamp))}</td>
          <td>${toLevelBadge(log.level)}</td>
          <td>${escapeHtml(log.module)}</td>
          <td>${escapeHtml(log.event)}</td>
          <td>${escapeHtml(log.actor)}</td>
        </tr>`
    )
    .join("");
};

const exportCsv = () => {
  if (!currentLogs.length) {
    toast("No logs to export", "warn");
    return;
  }

  const header = "timestamp,level,module,event,actor";
  const rows = currentLogs.map((log) =>
    [log.timestamp, log.level, log.module, log.event, log.actor]
      .map((item) => `\"${String(item || "").replace(/\"/g, '\"\"')}\"`)
      .join(",")
  );

  downloadTextFile(`system-logs-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join("\n"));
};

const loadLogs = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/admin/users"),
    apiRequest("/api/appointments"),
    apiRequest("/api/emergency/queue"),
    apiRequest("/api/payment/my")
  ]);

  const users = requests[0].status === "fulfilled" ? requests[0].value.users || [] : [];
  const appointments = requests[1].status === "fulfilled" ? requests[1].value.appointments || [] : [];
  const emergencies = requests[2].status === "fulfilled" ? requests[2].value.queue || [] : [];
  const payments = requests[3].status === "fulfilled" ? requests[3].value.payments || [] : [];

  const failed = requests.find((item) => item.status === "rejected");
  if (failed) {
    toast(failed.reason?.message || "Some logs could not be loaded", "warn");
  }

  currentLogs = buildLogs({ users, appointments, emergencies, payments });
  renderLogs(currentLogs);
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin"],
    onDenied: () => toast("Please login as super admin", "error")
  });
  if (!session.allowed) return;

  if (exportBtnEl) {
    exportBtnEl.addEventListener("click", () => {
      exportCsv();
    });
  }

  if (tableBodyEl) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-500)">Loading system logs...</td>
      </tr>`;
  }

  try {
    await loadLogs();
  } catch (error) {
    toast(error.message, "error");
    currentLogs = [];
    renderLogs([]);
  }
};

init();
