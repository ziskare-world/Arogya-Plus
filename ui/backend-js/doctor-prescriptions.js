import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession, formatDateTime } from "../js/api-client.js";
import { generatePrescriptionPdf } from "../js/pdf-generator.js";
import { evaluateClinicalSafety } from "../js/clinical-safety.js";
import { setupVoiceDictation } from "../js/voice-assistant.js";

window.toast = toast;
injectSidebar("prescriptions.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Issue E-Prescription");

const patientSelect = document.getElementById("prescription-patient");
const medicineInput = document.getElementById("prescription-medicine");
const dosageInput = document.getElementById("prescription-dosage");
const instructionsInput = document.getElementById("prescription-instructions");
const submitButton = document.getElementById("prescription-submit-btn");

const voiceRxBtn = document.getElementById("voice-rx-btn");
const voiceRxStatus = document.getElementById("voice-rx-status");

const patientStrip = document.getElementById("patient-strip");
const patientStripName = document.getElementById("patient-strip-name");
const patientStripId = document.getElementById("patient-strip-id");
const patientStripAllergies = document.getElementById("patient-strip-allergies");

const clinicalSafetyCard = document.getElementById("clinical-safety-card");
const safetyAlertIcon = document.getElementById("safety-alert-icon");
const safetyAlertTitle = document.getElementById("safety-alert-title");
const safetyAlertBody = document.getElementById("safety-alert-body");
const clinicalOverrideCheck = document.getElementById("clinical-override-check");

const pageContent = document.querySelector(".page-content");
let recordsTbody = null;
let recordsCountEl = null;

let patientsList = [];
let selectedPatient = null;
let prescriptionRecords = [];
let currentDoctor = null;
let currentSafetyResult = { safe: true, warnings: [] };

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
  card.style.marginTop = "24px";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">Issued Prescription Records</div>
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
            <th>Action</th>
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

  recordsTbody.addEventListener("click", (event) => {
    const printBtn = event.target.closest("button[data-action='print-rx']");
    if (!printBtn) return;
    const id = printBtn.getAttribute("data-id");
    const record = prescriptionRecords.find((r) => String(r._id) === String(id));
    if (!record) {
      toast("Prescription record not found", "error");
      return;
    }
    triggerPdfDownload(record);
  });
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
      const status = String(record.status || "active").toLowerCase();
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(record.createdAt))}</td>
          <td><strong>${escapeHtml(record.patient?.name || "Patient")}</strong></td>
          <td>${escapeHtml(record.medicineName || "-")}</td>
          <td>${escapeHtml(record.dosage || "-")}</td>
          <td>${escapeHtml(record.frequency || "-")}</td>
          <td><span class="${statusBadgeClass(status)}">${escapeHtml(statusLabel(status))}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" type="button" data-action="print-rx" data-id="${record._id}" style="padding:4px 8px;font-size:0.8rem">
              <span>📄</span> Print PDF
            </button>
          </td>
        </tr>`;
    })
    .join("");
};

const triggerPdfDownload = (record) => {
  const patientData = record.patient || selectedPatient || { name: "Patient" };
  const doctorData = record.doctor || currentDoctor || { name: "Dr. Consulting Physician" };

  generatePrescriptionPdf({
    prescriptionId: `RX-${String(record._id || Date.now()).slice(-6).toUpperCase()}`,
    date: record.createdAt ? formatDateTime(record.createdAt) : new Date().toLocaleDateString("en-IN"),
    doctor: doctorData,
    patient: patientData,
    medications: [
      {
        name: record.medicineName,
        dosage: record.dosage || "1 Tab",
        frequency: record.frequency || "1-0-1",
        instructions: record.instructions || "After meals as directed",
        duration: "5 Days"
      }
    ],
    clinicalNotes: record.instructions || "Follow prescription regimen diligently. Report any unexpected symptoms immediately.",
    nextFollowUp: record.nextRefillDate ? formatDateTime(record.nextRefillDate) : "As advised",
    allergies: patientData.allergies || []
  });
};

const updatePatientStrip = () => {
  if (!selectedPatient) {
    if (patientStrip) patientStrip.style.display = "none";
    return;
  }

  if (patientStrip) patientStrip.style.display = "block";
  if (patientStripName) patientStripName.textContent = selectedPatient.name || "Patient";
  if (patientStripId) patientStripId.textContent = `(ID: ${String(selectedPatient.id || selectedPatient._id).slice(-6)})`;

  if (patientStripAllergies) {
    const allergies = selectedPatient.allergies || [];
    if (allergies.length > 0) {
      patientStripAllergies.innerHTML = allergies
        .map((a) => `<span class="allergy-pill">⚠️ Allergy: ${escapeHtml(a)}</span>`)
        .join("");
    } else {
      patientStripAllergies.innerHTML = `<span style="font-size:0.8rem;color:#16a34a;font-weight:600">✔ No Known Allergies</span>`;
    }
  }
};

const runClinicalSafetyCheck = () => {
  if (!clinicalSafetyCard) return;

  const medicineName = medicineInput ? medicineInput.value.trim() : "";
  if (!selectedPatient || !medicineName) {
    clinicalSafetyCard.style.display = "none";
    currentSafetyResult = { safe: true, warnings: [] };
    return;
  }

  const patientAllergies = selectedPatient.allergies || [];
  const activeMedications = selectedPatient.activeMedications || [];

  const result = evaluateClinicalSafety({
    patientAllergies,
    activeMedications,
    newMedicineName: medicineName
  });

  currentSafetyResult = result;

  if (result.safe) {
    clinicalSafetyCard.style.display = "none";
  } else {
    clinicalSafetyCard.style.display = "block";
    clinicalSafetyCard.className = "clinical-alert-box";

    const worstSeverity = result.warnings.some((w) => w.severity === "CRITICAL" || w.severity === "CONTRAINDICATED")
      ? "critical"
      : result.warnings.some((w) => w.severity === "HIGH")
      ? "high"
      : "moderate";

    clinicalSafetyCard.classList.add(`clinical-alert-${worstSeverity}`);

    if (safetyAlertIcon) {
      safetyAlertIcon.textContent = worstSeverity === "critical" ? "⛔" : "⚠️";
    }

    if (safetyAlertTitle) {
      safetyAlertTitle.textContent = result.warnings[0]?.title || "Clinical Decision Support Safety Warning";
    }

    if (safetyAlertBody) {
      safetyAlertBody.innerHTML = result.warnings
        .map((w) => `<div style="margin-bottom:4px">• <strong>[${escapeHtml(w.severity)}]</strong> ${escapeHtml(w.message)}</div>`)
        .join("");
    }

    if (clinicalOverrideCheck) {
      clinicalOverrideCheck.checked = false;
    }
  }
};

const setFormEnabled = (enabled) => {
  if (patientSelect) patientSelect.disabled = !enabled;
  if (medicineInput) medicineInput.disabled = !enabled;
  if (dosageInput) dosageInput.disabled = !enabled;
  if (instructionsInput) instructionsInput.disabled = !enabled;
  if (submitButton) submitButton.disabled = !enabled;
};

const loadPatients = async () => {
  if (!patientSelect) return;
  patientSelect.innerHTML = '<option value="">Loading patients...</option>';
  setFormEnabled(false);

  const data = await apiRequest("/api/doctors/patients");
  patientsList = data.patients || [];

  if (!patientsList.length) {
    patientSelect.innerHTML = '<option value="">No assigned patients found</option>';
    setFormEnabled(false);
    return;
  }

  patientSelect.innerHTML = [
    '<option value="">Select patient</option>',
    ...patientsList.map(
      (patient) =>
        `<option value="${patient.id}">${patient.name} (${String(patient.id).slice(-6)})${patient.allergies?.length ? ` [Allergies: ${patient.allergies.join(", ")}]` : ""}</option>`
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
  prescriptionRecords = data.prescriptions || [];
  renderPrescriptionRecords(prescriptionRecords);
};

const issuePrescription = async () => {
  if (!patientSelect || !medicineInput || !dosageInput || !submitButton) return;

  const patientId = String(patientSelect.value || "").trim();
  const medicineName = String(medicineInput.value || "").trim();
  const dosage = String(dosageInput.value || "").trim();
  const instructions = instructionsInput ? String(instructionsInput.value || "").trim() : "";
  const overrideWarning = clinicalOverrideCheck ? clinicalOverrideCheck.checked : false;

  if (!patientId) {
    toast("Please select a patient", "error");
    return;
  }
  if (!medicineName) {
    toast("Medication name is required", "error");
    return;
  }
  if (!dosage) {
    toast("Dosage is required", "error");
    return;
  }

  // Safety gate enforcement
  if (!currentSafetyResult.safe && !overrideWarning) {
    toast("Clinical Contraindication! Check override box to authorize prescription.", "error");
    if (clinicalSafetyCard) {
      clinicalSafetyCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  try {
    submitButton.disabled = true;
    const originalLabel = submitButton.innerHTML;
    submitButton.innerHTML = "<span>⏳</span> Authorizing & Signing...";

    const res = await apiRequest("/api/doctors/prescriptions", {
      method: "POST",
      body: JSON.stringify({
        patientId,
        medicineName,
        dosage,
        frequency: dosage,
        instructions: instructions || "After meals as directed",
        overrideWarning
      })
    });

    toast("Prescription issued and digitally signed!", "success");

    // Automatically trigger official printable PDF!
    if (res.prescription) {
      triggerPdfDownload(res.prescription);
    }

    medicineInput.value = "";
    dosageInput.value = "";
    if (instructionsInput) instructionsInput.value = "";
    if (clinicalSafetyCard) clinicalSafetyCard.style.display = "none";
    currentSafetyResult = { safe: true, warnings: [] };

    await loadPrescriptionRecords();
    submitButton.innerHTML = originalLabel;
    submitButton.disabled = false;
  } catch (error) {
    toast(error.message, "error");
    submitButton.innerHTML = "<span>✍️</span> Sign & Issue Prescription";
    submitButton.disabled = false;
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["doctor"],
    onDenied: () => toast("Please login as doctor", "error")
  });
  if (!session.allowed) return;

  currentDoctor = session.user;

  if (submitButton) {
    submitButton.removeAttribute("onclick");
    submitButton.addEventListener("click", issuePrescription);
  }

  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      const selectedId = patientSelect.value;
      selectedPatient = patientsList.find((p) => String(p.id) === String(selectedId)) || null;
      updatePatientStrip();
      runClinicalSafetyCheck();
    });
  }

  if (medicineInput) {
    medicineInput.addEventListener("input", runClinicalSafetyCheck);
  }

  if (voiceRxBtn && medicineInput) {
    setupVoiceDictation({
      buttonEl: voiceRxBtn,
      inputEl: medicineInput,
      statusEl: voiceRxStatus,
      onResult: (text) => {
        if (text) {
          toast(`Dictated: "${text}"`, "info");
          runClinicalSafetyCheck();
        }
      }
    });
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
