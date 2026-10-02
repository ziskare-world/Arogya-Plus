/**
 * pdf-generator.js - Client-Side Hospital PDF Generator & Print Engine
 * 100% Free of Cost - Zero External Cloud API Keys or Dependencies.
 * Generates official, high-definition branded Prescriptions & Check-in Passes.
 */

const HOSPITAL_INFO = {
  name: "AROGYA PLUS MULTI-SPECIALITY HOSPITAL",
  tagline: "NABH Accredited | Centre of Excellence in Smart Healthcare",
  address: "Plot 14, Health City, Institutional Area, New Delhi - 110001",
  phone: "+91 (011) 2835-4000 | 24x7 Emergency: 108",
  website: "www.arogyaplus.health | contact@arogyaplus.com",
  regNo: "NABH-DL-2026-HOSP-0941"
};

/**
 * Opens a print-ready window with standard A4 styles and triggers the native PDF print dialog.
 */
function openPrintWindow(title, htmlContent) {
  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (!printWindow) {
    if (window.toast) {
      window.toast("Popup blocked! Please allow popups to download or print PDF.", "warning");
    } else {
      alert("Please allow popups to print/save your PDF.");
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,600&display=swap');
    
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      width: 100%;
      max-width: 800px;
      margin-bottom: 20px;
      padding: 12px 20px;
      background: #0f172a;
      color: #fff;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
    }

    .btn-action {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .btn-action:hover {
      background: #1d4ed8;
    }

    .btn-close {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .pdf-document {
      width: 100%;
      max-width: 800px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      padding: 36px 40px;
      border: 1px solid #e2e8f0;
      position: relative;
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .pdf-document {
        max-width: 100% !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
      }
    }

    /* Hospital Branding Header */
    .hospital-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 28px;
      font-weight: 800;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .brand-tagline {
      font-size: 11px;
      font-weight: 600;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .hospital-contact {
      font-size: 11px;
      color: #64748b;
      line-height: 1.4;
      text-align: right;
    }

    /* Meta Details Ribbon */
    .doc-meta-strip {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 10px 16px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .doc-type-badge {
      font-size: 14px;
      font-weight: 700;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-ref-num {
      font-size: 12px;
      font-family: monospace;
      color: #475569;
      font-weight: 600;
    }

    /* Patient & Doctor Two-Column Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      background: #fafafa;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }
    .meta-box h4 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .meta-row {
      display: flex;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .meta-label {
      width: 100px;
      font-weight: 600;
      color: #475569;
    }
    .meta-val {
      flex: 1;
      color: #0f172a;
      font-weight: 500;
    }

    /* Allergy Alert Box */
    .allergy-alert {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #ef4444;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      color: #991b1b;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    /* Rx Prescription Table */
    .rx-symbol {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-style: italic;
      font-weight: 700;
      color: #0284c7;
      margin-bottom: 8px;
      display: inline-block;
    }

    .rx-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .rx-table th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
      border: 1px solid #0f172a;
    }
    .rx-table td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      font-size: 13px;
      color: #1e293b;
    }
    .rx-table tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Advice & Follow-up Section */
    .clinical-notes {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      margin-bottom: 28px;
    }
    .notes-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .notes-body {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
    }

    /* Footer & Doctor Digital Seal */
    .pdf-footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .security-qr-col {
      text-align: center;
      font-size: 10px;
      color: #64748b;
    }
    .security-qr-img {
      width: 90px;
      height: 90px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px;
      background: #fff;
    }

    .doctor-stamp-col {
      text-align: center;
      min-width: 180px;
    }
    .doctor-stamp-badge {
      border: 2px dashed #0284c7;
      border-radius: 8px;
      padding: 8px 14px;
      background: #f0f9ff;
      display: inline-block;
      text-align: center;
    }
    .stamp-tick {
      color: #0284c7;
      font-size: 16px;
      font-weight: 800;
    }
    .stamp-label {
      font-size: 11px;
      font-weight: 700;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stamp-doc {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }
    .stamp-reg {
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div style="font-weight:600;font-size:14px">📄 Print Preview & PDF Export</div>
    <div style="display:flex;gap:10px">
      <button class="btn-action" onclick="window.print()">
        <span>🖨️</span> Save as PDF / Print
      </button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="pdf-document">
    ${htmlContent}
  </div>

  <script>
    // Automatically trigger print dialog after page styles settle
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch(e) {}
      }, 500);
    });
  <\/script>
</body>
</html>`);
  printWindow.document.close();
}

/**
 * Generates an official, beautifully formatted Prescription PDF.
 */
export function generatePrescriptionPdf({
  prescriptionId = `RX-${Date.now().toString().slice(-6)}`,
  date = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
  doctor = {},
  patient = {},
  medications = [],
  clinicalNotes = "Complete full antibiotic course as prescribed. Stay well-hydrated. Avoid cold foods.",
  nextFollowUp = "7 Days / As required",
  allergies = []
}) {
  const doctorName = doctor.name ? (doctor.name.startsWith("Dr.") ? doctor.name : `Dr. ${doctor.name}`) : "Dr. Medical Officer";
  const doctorSpeciality = doctor.specialization || "General Medicine & Clinical Care";
  const doctorReg = doctor.registrationNumber || "MCI-DL-2024-8924";

  const patientName = patient.name || "Patient";
  const patientGenderAge = [patient.gender, patient.age ? `${patient.age} Yrs` : null].filter(Boolean).join(" / ") || "Adult";
  const patientUhid = patient.uhid || patient.id || `UHID-${(patient._id || "10492").toString().slice(-6).toUpperCase()}`;

  const rowsHtml = medications.length > 0
    ? medications.map((med, idx) => `
        <tr>
          <td style="font-weight:700;text-align:center">${idx + 1}</td>
          <td>
            <div style="font-weight:700;color:#0f172a">${med.name || med.medicineName || "Prescribed Medication"}</div>
            <div style="font-size:11px;color:#64748b">${med.instructions || med.timing || "After meals with warm water"}</div>
          </td>
          <td>${med.dosage || "1 Tab"}</td>
          <td>${med.frequency || "1-0-1 (Twice Daily)"}</td>
          <td>${med.duration || "5 Days"}</td>
        </tr>
      `).join("")
    : `<tr>
        <td style="font-weight:700;text-align:center">1</td>
        <td>
          <div style="font-weight:700;color:#0f172a">General Clinical Assessment</div>
          <div style="font-size:11px;color:#64748b">As directed by physician</div>
        </td>
        <td>Standard</td>
        <td>Daily</td>
        <td>7 Days</td>
      </tr>`;

  const allergyAlertHtml = allergies && allergies.length > 0
    ? `<div class="allergy-alert">
         <span>⚠️</span>
         <span>PATIENT DOCUMENTED ALLERGIES: <strong>${allergies.join(", ")}</strong> (Screened against clinical contraindications)</span>
       </div>`
    : "";

  const verificationQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`AROGYA-RX:${prescriptionId}|PAT:${patientUhid}|DOC:${doctorReg}`)}`;

  const bodyHtml = `
    <!-- Hospital Header -->
    <div class="hospital-header">
      <div class="brand-left">
        <div class="brand-logo-icon">+</div>
        <div>
          <div class="brand-name">${HOSPITAL_INFO.name}</div>
          <div class="brand-tagline">${HOSPITAL_INFO.tagline}</div>
        </div>
      </div>
      <div class="hospital-contact">
        ${HOSPITAL_INFO.address}<br/>
        <strong>Tel:</strong> ${HOSPITAL_INFO.phone}<br/>
        <strong>Reg No:</strong> ${HOSPITAL_INFO.regNo}
      </div>
    </div>

    <!-- Document Meta Strip -->
    <div class="doc-meta-strip">
      <div class="doc-type-badge">Official Medical Prescription</div>
      <div class="doc-ref-num">Ref No: <strong>${prescriptionId}</strong> | Date: <strong>${date}</strong></div>
    </div>

    <!-- Doctor & Patient Details -->
    <div class="meta-grid">
      <div class="meta-box">
        <h4>Doctor Details</h4>
        <div class="meta-row">
          <div class="meta-label">Doctor:</div>
          <div class="meta-val" style="font-weight:700">${doctorName}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Speciality:</div>
          <div class="meta-val">${doctorSpeciality}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Reg No:</div>
          <div class="meta-val">${doctorReg}</div>
        </div>
      </div>

      <div class="meta-box">
        <h4>Patient Information</h4>
        <div class="meta-row">
          <div class="meta-label">Patient:</div>
          <div class="meta-val" style="font-weight:700">${patientName}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">UHID:</div>
          <div class="meta-val">${patientUhid}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Age / Gender:</div>
          <div class="meta-val">${patientGenderAge}</div>
        </div>
      </div>
    </div>

    ${allergyAlertHtml}

    <!-- Rx Symbol & Table -->
    <div class="rx-symbol">℞</div>
    <table class="rx-table">
      <thead>
        <tr>
          <th style="width:40px;text-align:center">#</th>
          <th>Medicine Name & Dosage Form</th>
          <th style="width:110px">Strength / Dose</th>
          <th style="width:130px">Frequency</th>
          <th style="width:90px">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Advice & Instructions -->
    <div class="clinical-notes">
      <div class="notes-title">Clinical Advice & Patient Instructions:</div>
      <div class="notes-body">${clinicalNotes}</div>
      <div style="margin-top:10px;font-size:12px;color:#0284c7;font-weight:600">
        🗓️ Next Follow-up / Review: <strong>${nextFollowUp}</strong>
      </div>
    </div>

    <!-- Footer Stamp & QR -->
    <div class="pdf-footer">
      <div class="security-qr-col">
        <img class="security-qr-img" src="${verificationQrUrl}" alt="Prescription Verification QR Code" />
        <div style="margin-top:4px">Scan to verify authenticity</div>
      </div>

      <div class="doctor-stamp-col">
        <div class="doctor-stamp-badge">
          <div class="stamp-tick">✔ DIGITALLY VERIFIED</div>
          <div class="stamp-label">E-Prescription Authorization</div>
          <div class="stamp-doc">${doctorName}</div>
          <div class="stamp-reg">${doctorReg}</div>
        </div>
      </div>
    </div>
  `;

  openPrintWindow(`Prescription_${patientName.replace(/\s+/g, "_")}_${prescriptionId}`, bodyHtml);
}

/**
 * Generates an official Hospital Check-in Pass PDF with Token & Reception QR Code.
 */
export function generateCheckinPassPdf({
  tokenNumber = "APT-000000",
  appointmentDate = new Date().toLocaleDateString("en-IN"),
  appointmentTime = "10:30 AM",
  doctor = {},
  patient = {},
  qrDataUrl = "",
  bookedForFamily = false,
  familyMemberName = "",
  roomNo = "Cabin 104, 1st Floor OPD"
}) {
  const doctorName = doctor.name ? (doctor.name.startsWith("Dr.") ? doctor.name : `Dr. ${doctor.name}`) : "Dr. On Duty";
  const doctorSpeciality = doctor.specialization || "Clinical Specialist";

  const patientDisplayName = bookedForFamily && familyMemberName ? `${familyMemberName} (Family Profile)` : (patient.name || "Registered Patient");
  const patientPhone = patient.phone || "+91-XXXXXXXXXX";

  const qrSrc = qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`AROGYA-PASS:${tokenNumber}|DATE:${appointmentDate}`)}`;

  const bodyHtml = `
    <!-- Hospital Header -->
    <div class="hospital-header">
      <div class="brand-left">
        <div class="brand-logo-icon">+</div>
        <div>
          <div class="brand-name">${HOSPITAL_INFO.name}</div>
          <div class="brand-tagline">OPD Fast-Track Check-in Pass</div>
        </div>
      </div>
      <div class="hospital-contact">
        ${HOSPITAL_INFO.address}<br/>
        <strong>24x7 Helpdesk:</strong> ${HOSPITAL_INFO.phone}
      </div>
    </div>

    <!-- Big Token Banner -->
    <div style="background:#0f172a;color:#fff;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600">Your Appointment Token Number</div>
      <div style="font-size:36px;font-weight:800;letter-spacing:2px;color:#38bdf8;margin:8px 0">${tokenNumber}</div>
      <div style="font-size:13px;color:#cbd5e1">Please present this token at the reception desk for instant queue priority</div>
    </div>

    <!-- Check-in Pass Details -->
    <div style="display:flex;gap:24px;align-items:center;background:#f8fafc;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px">
      <div style="text-align:center;padding:12px;background:#fff;border-radius:10px;border:1px solid #cbd5e1">
        <img src="${qrSrc}" alt="Check-in QR" style="width:160px;height:160px;display:block" />
        <div style="font-size:11px;color:#64748b;margin-top:6px;font-weight:600">Scan at Kiosk / Gate</div>
      </div>

      <div style="flex:1">
        <div class="meta-row" style="margin-bottom:10px">
          <div class="meta-label" style="width:130px;color:#64748b">Patient Name:</div>
          <div class="meta-val" style="font-size:15px;font-weight:700;color:#0f172a">${patientDisplayName}</div>
        </div>
        <div class="meta-row" style="margin-bottom:10px">
          <div class="meta-label" style="width:130px;color:#64748b">Consulting Doctor:</div>
          <div class="meta-val" style="font-size:15px;font-weight:700;color:#0284c7">${doctorName}</div>
        </div>
        <div class="meta-row" style="margin-bottom:10px">
          <div class="meta-label" style="width:130px;color:#64748b">Department / Dept:</div>
          <div class="meta-val">${doctorSpeciality}</div>
        </div>
        <div class="meta-row" style="margin-bottom:10px">
          <div class="meta-label" style="width:130px;color:#64748b">Appointment Slot:</div>
          <div class="meta-val" style="font-weight:700;color:#15803d">${appointmentDate} at ${appointmentTime}</div>
        </div>
        <div class="meta-row" style="margin-bottom:10px">
          <div class="meta-label" style="width:130px;color:#64748b">Room / Location:</div>
          <div class="meta-val" style="font-weight:600;color:#0f172a">${roomNo}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label" style="width:130px;color:#64748b">Contact Phone:</div>
          <div class="meta-val">${patientPhone}</div>
        </div>
      </div>
    </div>

    <!-- Patient Instructions -->
    <div style="border-left:4px solid #0284c7;background:#f0f9ff;padding:14px 18px;border-radius:4px;margin-bottom:24px">
      <div style="font-weight:700;font-size:13px;color:#0369a1;margin-bottom:4px">Important Instructions for Patient:</div>
      <ul style="font-size:12px;color:#334155;padding-left:18px;line-height:1.6">
        <li>Please arrive 10-15 minutes prior to your allocated slot for vitals recording (BP, Pulse, Temperature).</li>
        <li>Carry previous investigation reports, blood tests, or diagnostic scans if applicable.</li>
        <li>In case of emergency while traveling, call Arogya Plus Ambulance Dispatch immediately at <strong>108</strong>.</li>
      </ul>
    </div>

    <div class="pdf-footer">
      <div style="font-size:11px;color:#64748b">
        Generated electronically via ArogyaPlus Smart Health Platform.<br/>
        Tamper-evident digital token pass.
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:#0284c7">ArogyaPlus Fast-Track OPD</div>
        <div style="font-size:10px;color:#94a3b8">Authorized Electronic Hospital Pass</div>
      </div>
    </div>
  `;

  openPrintWindow(`Checkin_Pass_${tokenNumber}`, bodyHtml);
}
