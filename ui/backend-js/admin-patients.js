import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("patients.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Patient Management");

const tableBodyEl = document.getElementById("pat-tbody");

let allPatients = [];
let allAppointments = [];
let activeEmergencies = [];
let hospitalDoctors = [];

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatPatientCode = (id = "") => `PAT-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;

const toBadge = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "critical") return '<span class="badge badge-red">Critical</span>';
  if (normalized === "discharged" || normalized === "inactive") return '<span class="badge badge-blue">Discharged</span>';
  return '<span class="badge badge-green">Active</span>';
};

const avatar = (name = "Patient") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "PT";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
};

const normalizeId = (value) => String(value || "").trim();

const extractId = (entity) => {
  if (!entity) return "";
  if (typeof entity === "string") return normalizeId(entity);
  return normalizeId(entity._id || entity.id);
};

const getPatientAppointments = (patientId) =>
  allAppointments
    .filter((appointment) => {
      const patient = appointment.patient;
      if (!patient) return false;
      if (typeof patient === "string") return patient === patientId;
      return patient._id === patientId || patient.id === patientId;
    })
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

const computePatientStatus = (patient) => {
  const inEmergency = activeEmergencies.some(
    (emergency) =>
      String(emergency.patientName || "").trim().toLowerCase() === String(patient.name || "").trim().toLowerCase()
  );
  if (inEmergency) return "critical";
  if (patient.isActive === false) return "discharged";
  return "active";
};

const renderStats = () => {
  const statusList = allPatients.map((patient) => computePatientStatus(patient));
  const total = allPatients.length;
  const active = statusList.filter((status) => status === "active").length;
  const critical = statusList.filter((status) => status === "critical").length;
  const discharged = statusList.filter((status) => status === "discharged").length;

  const statEls = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  if (statEls[0]) statEls[0].textContent = total.toLocaleString("en-IN");
  if (statEls[1]) statEls[1].textContent = active.toLocaleString("en-IN");
  if (statEls[2]) statEls[2].textContent = critical.toLocaleString("en-IN");
  if (statEls[3]) statEls[3].textContent = discharged.toLocaleString("en-IN");

  const subtitleEl = document.querySelector(".page-header p");
  if (subtitleEl) {
    subtitleEl.textContent = `${total.toLocaleString("en-IN")} patients under active care & consultation`;
  }
};

const renderPatients = (patients) => {
  if (!tableBodyEl) return;

  if (!patients.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--text-500);padding:30px;">No patients found in your hospital records.</td>
      </tr>`;
    return;
  }

  tableBodyEl.innerHTML = patients
    .map((patient) => {
      const id = patient._id || patient.id || "";
      const status = computePatientStatus(patient);
      const visits = getPatientAppointments(id);
      const lastVisit = visits[0]?.appointmentDate || patient.createdAt;

      return `
        <tr>
          <td><code style="color:var(--blue);font-size:.78rem">${escapeHtml(formatPatientCode(id))}</code></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="avatar avatar-sm" style="background:var(--blue);color:#fff">${escapeHtml(avatar(patient.name))}</div>
              <div>
                <div style="font-weight:600">${escapeHtml(patient.name || "Unknown Patient")}</div>
                <div style="font-size:0.75rem;color:var(--text-400)">${escapeHtml(patient.email || "")}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(String(patient.age || "-"))}</td>
          <td><span class="badge badge-red">${escapeHtml(patient.bloodGroup || patient.blood || "--")}</span></td>
          <td style="color:var(--text-400)">${escapeHtml(patient.phone || "-")}</td>
          <td style="color:var(--text-400)">${escapeHtml(formatDate(lastVisit))}</td>
          <td>${toBadge(status)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="openPatientView('${id}')">View</button>
              <button class="btn btn-ghost btn-sm" onclick="openPatientEdit('${id}')">Edit</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
};

const loadData = async () => {
  const requests = await Promise.allSettled([
    apiRequest("/api/admin/users?role=patient"),
    apiRequest("/api/appointments"),
    apiRequest("/api/emergency/queue"),
    apiRequest("/api/admin/doctors")
  ]);

  const loadedPatients = requests[0].status === "fulfilled" ? requests[0].value.users || [] : [];
  const loadedAppointments = requests[1].status === "fulfilled" ? requests[1].value.appointments || [] : [];
  const loadedQueue = requests[2].status === "fulfilled" ? requests[2].value.queue || [] : [];
  hospitalDoctors = requests[3].status === "fulfilled" ? requests[3].value.doctors || [] : [];
  const doctorsLoaded = requests[3].status === "fulfilled";

  const doctorIds = new Set(hospitalDoctors.map((doctor) => extractId(doctor)).filter(Boolean));
  const appointmentsScopedByDoctor = loadedAppointments.filter((appointment) => {
    const doctorId = extractId(appointment?.doctor);
    if (!doctorId) return false;
    if (!doctorsLoaded) return true;
    return doctorIds.has(doctorId);
  });

  allAppointments = appointmentsScopedByDoctor;
  allPatients = loadedPatients;

  const scopedPatientNames = new Set(
    allPatients
      .map((patient) => String(patient?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  activeEmergencies = loadedQueue.filter((item) =>
    scopedPatientNames.has(String(item?.patientName || "").trim().toLowerCase())
  );

  const failed = requests.find((result) => result.status === "rejected");
  if (failed) {
    toast(failed.reason?.message || "Some patient data could not be loaded", "warn");
  }
};

window.searchPat = function searchPat(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) {
    renderPatients(allPatients);
    return;
  }

  const filtered = allPatients.filter((patient) => {
    const code = formatPatientCode(patient._id || patient.id || "");
    const blob = `${patient.name || ""} ${patient.phone || ""} ${patient.email || ""} ${code}`.toLowerCase();
    return blob.includes(query);
  });
  renderPatients(filtered);
};

// ADD PATIENT
window.openAddPatientModal = () => {
  const modal = document.getElementById("add-patient-modal");
  if (modal) modal.style.display = "flex";
};

window.closeAddPatientModal = () => {
  const modal = document.getElementById("add-patient-modal");
  if (modal) modal.style.display = "none";
  const form = document.getElementById("add-patient-form");
  if (form) form.reset();
};

window.submitAddPatient = async (e) => {
  e.preventDefault();
  const name = document.getElementById("add-pat-name")?.value.trim();
  const email = document.getElementById("add-pat-email")?.value.trim();
  const phone = document.getElementById("add-pat-phone")?.value.trim();
  const age = document.getElementById("add-pat-age")?.value;
  const gender = document.getElementById("add-pat-gender")?.value;
  const bloodGroup = document.getElementById("add-pat-blood")?.value;
  const emergencyContact = document.getElementById("add-pat-emg")?.value.trim();
  const address = document.getElementById("add-pat-address")?.value.trim();

  const submitBtn = document.getElementById("btn-save-patient");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await apiRequest("/api/admin/patients", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, age, gender, bloodGroup, emergencyContact, address })
    });

    toast("Patient registered successfully!", "success");
    closeAddPatientModal();
    if (res.patient) {
      allPatients.unshift(res.patient);
      renderStats();
      renderPatients(allPatients);
    } else {
      await loadData();
      renderStats();
      renderPatients(allPatients);
    }
  } catch (err) {
    toast(err.message || "Failed to register patient", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

// VIEW PATIENT
window.openPatientView = async (id) => {
  const modal = document.getElementById("view-patient-modal");
  const content = document.getElementById("patient-details-content");
  if (!modal || !content) return;

  modal.style.display = "flex";
  content.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-400)">Loading patient details...</div>`;

  try {
    const res = await apiRequest(`/api/admin/patients/${id}`);
    const p = res.patient || {};
    const h = res.history || {};

    const apptRows = (h.appointments || []).slice(0, 5).map((a) => {
      const docRaw = a.doctor?.name || "Consultant";
      const docLabel = /^dr\.?\s+/i.test(docRaw) ? docRaw : `Dr. ${docRaw}`;
      return `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color, #334155);font-size:0.85rem;">
        <div>
          <strong>${formatDate(a.appointmentDate)}</strong> - ${escapeHtml(docLabel)}
          <div style="color:var(--text-400);font-size:0.8rem">${escapeHtml(a.reason || "General Consultation")}</div>
        </div>
        <div><span class="badge badge-${a.status === 'completed' ? 'green' : 'blue'}">${a.status}</span></div>
      </div>
    `;
    }).join("") || `<div style="color:var(--text-400);font-size:0.85rem;padding:8px 0;">No appointment records found.</div>`;


    const labRows = (h.labBookings || []).slice(0, 5).map((l) => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color, #334155);font-size:0.85rem;">
        <div>
          <strong>${escapeHtml(l.testName)}</strong>
          <div style="color:var(--text-400);font-size:0.8rem">${formatDate(l.bookingDate)} • ₹${l.price}</div>
        </div>
        <div>
          <span class="badge badge-${l.status === 'completed' ? 'green' : 'yellow'}">${l.status}</span>
          ${l.status === 'completed' ? `<a href="/api/lab-tests/bookings/${l._id}/report" target="_blank" class="btn btn-ghost btn-xs" style="margin-left:6px">📄 Report</a>` : ''}
        </div>
      </div>
    `).join("") || `<div style="color:var(--text-400);font-size:0.85rem;padding:8px 0;">No diagnostic lab tests recorded.</div>`;

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div class="avatar" style="width:52px;height:52px;background:var(--blue);color:#fff;font-size:1.2rem;display:flex;align-items:center;justify-content:center;border-radius:50%;">${escapeHtml(avatar(p.name))}</div>
        <div>
          <h4 style="margin:0;font-size:1.2rem;font-weight:700;">${escapeHtml(p.name || "Patient")}</h4>
          <div style="color:var(--text-400);font-size:0.85rem;"><code>${escapeHtml(formatPatientCode(p._id))}</code> • ${escapeHtml(p.hospitalName || "Hospital Record")}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin-bottom:20px;background:var(--bg-panel, #0f172a);padding:14px;border-radius:8px;">
        <div><small style="color:var(--text-400);display:block;">Phone</small><strong>${escapeHtml(p.phone || "-")}</strong></div>
        <div><small style="color:var(--text-400);display:block;">Email</small><strong>${escapeHtml(p.email || "-")}</strong></div>
        <div><small style="color:var(--text-400);display:block;">Age / Gender</small><strong>${escapeHtml(String(p.age || "-"))} Yrs / ${escapeHtml(p.gender || "-")}</strong></div>
        <div><small style="color:var(--text-400);display:block;">Blood Group</small><span class="badge badge-red">${escapeHtml(p.bloodGroup || "--")}</span></div>
        <div><small style="color:var(--text-400);display:block;">Address</small><strong>${escapeHtml(p.address || "-")}</strong></div>
        <div><small style="color:var(--text-400);display:block;">Emergency Contact</small><strong>${escapeHtml(p.emergencyContact || "-")}</strong></div>
      </div>

      <h5 style="margin:0 0 10px;font-size:0.95rem;border-bottom:1px solid var(--border-color, #334155);padding-bottom:6px;">📅 Recent Hospital Appointments</h5>
      <div style="margin-bottom:18px;">${apptRows}</div>

      <h5 style="margin:0 0 10px;font-size:0.95rem;border-bottom:1px solid var(--border-color, #334155);padding-bottom:6px;">🧪 Diagnostic Lab Tests</h5>
      <div>${labRows}</div>
    `;
  } catch (err) {
    content.innerHTML = `<div style="color:var(--red);padding:20px;">Failed to load patient record: ${err.message}</div>`;
  }
};

window.closePatientViewModal = () => {
  const modal = document.getElementById("view-patient-modal");
  if (modal) modal.style.display = "none";
};

// EDIT PATIENT
window.openPatientEdit = (id) => {
  const patient = allPatients.find((p) => String(p._id || p.id) === String(id));
  if (!patient) return;

  const modal = document.getElementById("edit-patient-modal");
  if (!modal) return;

  document.getElementById("edit-pat-id").value = id;
  document.getElementById("edit-pat-name").value = patient.name || "";
  document.getElementById("edit-pat-phone").value = patient.phone || "";
  document.getElementById("edit-pat-age").value = patient.age || "";
  document.getElementById("edit-pat-gender").value = patient.gender || "Male";
  document.getElementById("edit-pat-blood").value = patient.bloodGroup || patient.blood || "O+";
  document.getElementById("edit-pat-address").value = patient.address || "";

  modal.style.display = "flex";
};

window.closePatientEditModal = () => {
  const modal = document.getElementById("edit-patient-modal");
  if (modal) modal.style.display = "none";
};

window.submitEditPatient = async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-pat-id")?.value;
  const name = document.getElementById("edit-pat-name")?.value.trim();
  const phone = document.getElementById("edit-pat-phone")?.value.trim();
  const age = document.getElementById("edit-pat-age")?.value;
  const gender = document.getElementById("edit-pat-gender")?.value;
  const bloodGroup = document.getElementById("edit-pat-blood")?.value;
  const address = document.getElementById("edit-pat-address")?.value.trim();

  try {
    await apiRequest(`/api/admin/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, phone, age, gender, bloodGroup, address })
    });

    toast("Patient profile updated!", "success");
    closePatientEditModal();

    const idx = allPatients.findIndex((p) => String(p._id || p.id) === String(id));
    if (idx !== -1) {
      allPatients[idx] = { ...allPatients[idx], name, phone, age, gender, bloodGroup, address };
      renderPatients(allPatients);
    }
  } catch (err) {
    toast(err.message || "Failed to update patient", "error");
  }
};

// EXPORT CSV
window.exportPatientsCsv = () => {
  if (!allPatients.length) {
    toast("No patient records to export", "info");
    return;
  }

  const headers = ["Patient ID", "Name", "Email", "Phone", "Age", "Gender", "Blood Group", "Status", "Created At"];
  const rows = allPatients.map((p) => [
    formatPatientCode(p._id || p.id),
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.email || '').replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    p.age || '',
    p.gender || '',
    p.bloodGroup || p.blood || '',
    computePatientStatus(p),
    formatDate(p.createdAt)
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `hospital_patients_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Hospital patients CSV exported successfully", "success");
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin"],
    onDenied: () => toast("Please login as admin", "error")
  });
  if (!session.allowed) return;

  if (tableBodyEl) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:var(--text-500);padding:30px;">Loading patients...</td>
      </tr>`;
  }

  try {
    await loadData();
    renderStats();
    renderPatients(allPatients);
  } catch (error) {
    toast(error.message, "error");
    renderPatients([]);
  }
};

init();
