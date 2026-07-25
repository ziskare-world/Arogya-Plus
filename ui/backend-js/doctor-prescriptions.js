import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";

window.toast = toast;
injectSidebar("prescriptions.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Issue Prescription");

const formCard = document.querySelector(".card");
const pageContent = document.querySelector(".page-content");
const patientSelect = formCard?.querySelector("select.form-input");
const inputFields = formCard?.querySelectorAll("input.form-input") || [];
const medicineInput = inputFields[0] || null;
const dosageInput = inputFields[1] || null;
const submitButton = formCard?.querySelector("button.btn.btn-primary");

let recordsTbody = null;
let recordsCountEl = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const statusBadgeClass = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (normalized === "active") return "badge badge-green";
  if (normalized === "completed") return "badge badge-blue";
  if (normalized === "discontinued") return "badge badge-red";
  return "badge badge-yellow";
};

const statusLabel = (status = "") => {
  const normalized = String(status).toLowerCase();
  if (!normalized) return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const ensureRecordsSection = () => {
  if (recordsTbody || !pageContent) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "20px";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">Prescription Records</div>
      <span id="prescription-record-count" class="badge badge-blue">0</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Status</th>
            <th>Next Refill</th>
          </tr>
        </thead>
        <tbody id="prescription-records-body">
          <tr>
            <td colspan="7" style="text-align:center;color:var(--text-500)">Loading prescription records...</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  pageContent.appendChild(card);
  recordsTbody = card.querySelector("#prescription-records-body");
  recordsCountEl = card.querySelector("#prescription-record-count");
};

const renderPrescriptionRecords = (records = []) => {
  ensureRecordsSection();
  if (!recordsTbody) return;

  if (recordsCountEl) {
    recordsCountEl.textContent = String(records.length);
  }

  if (!records.length) {
    recordsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-500)">No prescriptions issued yet.</td>
      </tr>`;
    return;
  }

  recordsTbody.innerHTML = records
    .map((record) => {
      const refill = record.nextRefillDate ? formatDateTime(record.nextRefillDate) : "-";
      const status = String(record.status || "active").toLowerCase();
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(record.createdAt))}</td>
          <td>${escapeHtml(record.patient?.name || "Unknown Patient")}</td>
          <td>${escapeHtml(record.medicineName || "-")}</td>
          <td>${escapeHtml(record.dosage || "-")}</td>
          <td>${escapeHtml(record.frequency || "-")}</td>
          <td><span class="${statusBadgeClass(status)}">${escapeHtml(statusLabel(status))}</span></td>
          <td>${escapeHtml(refill)}</td>
        </tr>`;
    })
    .join("");
};

const setFormEnabled = (enabled) => {
  if (patientSelect) patientSelect.disabled = !enabled;
  if (medicineInput) medicineInput.disabled = !enabled;
  if (dosageInput) dosageInput.disabled = !enabled;
  if (submitButton) submitButton.disabled = !enabled;
};

const loadPatients = async () => {
  if (!patientSelect) return;
  patientSelect.innerHTML = '<option value="">Loading patients...</option>';
  setFormEnabled(false);

  const data = await apiRequest("/api/doctors/patients");
  const patients = data.patients || [];

  if (!patients.length) {
    patientSelect.innerHTML = '<option value="">No assigned patients found</option>';
    setFormEnabled(false);
    return;
  }

  patientSelect.innerHTML = [
    '<option value="">Select patient</option>',
    ...patients.map(
      (patient) => `<option value="${patient.id}">${patient.name} (${String(patient.id).slice(-6)})</option>`
    )
  ].join("");

  setFormEnabled(true);
};

const loadPrescriptionRecords = async () => {
  ensureRecordsSection();
  if (recordsTbody) {
    recordsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-500)">Loading prescription records...</td>
      </tr>`;
  }

  const data = await apiRequest("/api/doctors/prescriptions");
  renderPrescriptionRecords(data.prescriptions || []);
};

const issuePrescription = async () => {
  if (!patientSelect || !medicineInput || !dosageInput || !submitButton) return;

  const patientId = String(patientSelect.value || "").trim();
  const medicineName = String(medicineInput.value || "").trim();
  const dosage = String(dosageInput.value || "").trim();

  if (!patientId) {
    toast("Please select a patient", "error");
    return;
  }
  if (!medicineName) {
    toast("Medication is required", "error");
    return;
  }
  if (!dosage) {
    toast("Dosage is required", "error");
    return;
  }

  try {
    submitButton.disabled = true;
    const originalLabel = submitButton.textContent;
    submitButton.textContent = "Sending...";

    await apiRequest("/api/doctors/prescriptions", {
      method: "POST",
      body: JSON.stringify({
        patientId,
        medicineName,
        dosage,
        frequency: dosage
      })
    });

    toast("Prescription issued successfully", "success");
    medicineInput.value = "";
    dosageInput.value = "";
    await loadPrescriptionRecords();
    submitButton.textContent = originalLabel;
    submitButton.disabled = false;
  } catch (error) {
    toast(error.message, "error");
    submitButton.textContent = "Sign & Send";
    submitButton.disabled = false;
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["doctor"],
    onDenied: () => toast("Please login as doctor", "error")
  });
  if (!session.allowed) return;

  if (submitButton) {
    submitButton.removeAttribute("onclick");
    submitButton.addEventListener("click", issuePrescription);
  }

  try {
    await loadPatients();
  } catch (error) {
    toast(error.message, "error");
    if (patientSelect) {
      patientSelect.innerHTML = '<option value="">Unable to load patients</option>';
    }
    setFormEnabled(false);
  }

  try {
    await loadPrescriptionRecords();
  } catch (error) {
    toast(error.message, "error");
    renderPrescriptionRecords([]);
  }
};

init();
