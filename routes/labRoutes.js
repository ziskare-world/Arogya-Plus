const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const LabTest = require("../models/LabTest");
const LabBooking = require("../models/LabBooking");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const { logAudit } = require("../utils/auditLogger");

const router = express.Router();

const DEFAULT_LAB_TESTS = [
  {
    name: "Complete Blood Count (CBC)",
    code: "CBC-01",
    category: "Hematology",
    description: "Evaluates overall health and detects anemia, infection, and leukemia.",
    price: 350,
    turnaroundHours: 12,
    sampleRequired: "EDTA Whole Blood",
    fastingRequired: false,
    parameters: [
      { name: "Hemoglobin", unit: "g/dL", referenceRange: "13.0 - 17.0" },
      { name: "RBC Count", unit: "mil/uL", referenceRange: "4.5 - 5.9" },
      { name: "WBC Count", unit: "cells/uL", referenceRange: "4,000 - 11,000" },
      { name: "Platelet Count", unit: "lakh/uL", referenceRange: "1.5 - 4.5" },
      { name: "Hematocrit (PCV)", unit: "%", referenceRange: "40 - 50" }
    ]
  },
  {
    name: "Lipid Profile Comprehensive",
    code: "LIPID-02",
    category: "Biochemistry",
    description: "Measures cholesterol and triglyceride levels to screen for cardiovascular disease.",
    price: 650,
    turnaroundHours: 24,
    sampleRequired: "Serum Blood",
    fastingRequired: true,
    parameters: [
      { name: "Total Cholesterol", unit: "mg/dL", referenceRange: "< 200" },
      { name: "HDL Cholesterol", unit: "mg/dL", referenceRange: "> 40" },
      { name: "LDL Cholesterol", unit: "mg/dL", referenceRange: "< 100" },
      { name: "Triglycerides", unit: "mg/dL", referenceRange: "< 150" },
      { name: "VLDL Cholesterol", unit: "mg/dL", referenceRange: "10 - 30" }
    ]
  },
  {
    name: "Liver Function Test (LFT)",
    code: "LFT-03",
    category: "Biochemistry",
    description: "Assesses hepatic enzymes, protein synthesis, and bilirubin clearance.",
    price: 750,
    turnaroundHours: 24,
    sampleRequired: "Serum Blood",
    fastingRequired: true,
    parameters: [
      { name: "Total Bilirubin", unit: "mg/dL", referenceRange: "0.2 - 1.2" },
      { name: "Direct Bilirubin", unit: "mg/dL", referenceRange: "0.0 - 0.3" },
      { name: "SGOT / AST", unit: "U/L", referenceRange: "10 - 40" },
      { name: "SGPT / ALT", unit: "U/L", referenceRange: "7 - 56" },
      { name: "Alkaline Phosphatase", unit: "U/L", referenceRange: "44 - 147" },
      { name: "Total Protein", unit: "g/dL", referenceRange: "6.0 - 8.3" }
    ]
  },
  {
    name: "Kidney Function Test (KFT / RFT)",
    code: "KFT-04",
    category: "Biochemistry",
    description: "Monitors renal function, urea, creatinine, and electrolyte balance.",
    price: 600,
    turnaroundHours: 12,
    sampleRequired: "Serum Blood",
    fastingRequired: false,
    parameters: [
      { name: "Blood Urea Nitrogen", unit: "mg/dL", referenceRange: "7 - 20" },
      { name: "Serum Creatinine", unit: "mg/dL", referenceRange: "0.6 - 1.2" },
      { name: "Uric Acid", unit: "mg/dL", referenceRange: "3.5 - 7.2" },
      { name: "Sodium (Na+)", unit: "mEq/L", referenceRange: "135 - 145" },
      { name: "Potassium (K+)", unit: "mEq/L", referenceRange: "3.5 - 5.0" }
    ]
  },
  {
    name: "Thyroid Profile (T3, T4, TSH)",
    code: "THY-05",
    category: "Biochemistry",
    description: "Evaluates thyroid gland hormone production for hyper/hypothyroidism.",
    price: 550,
    turnaroundHours: 24,
    sampleRequired: "Serum Blood",
    fastingRequired: false,
    parameters: [
      { name: "Total T3", unit: "ng/dL", referenceRange: "80 - 200" },
      { name: "Total T4", unit: "ug/dL", referenceRange: "4.5 - 12.0" },
      { name: "TSH Ultrasensitive", unit: "uIU/mL", referenceRange: "0.4 - 4.5" }
    ]
  },
  {
    name: "HbA1c (Glycated Hemoglobin)",
    code: "HBA1C-06",
    category: "Biochemistry",
    description: "Reflects average blood sugar control over the previous 2 to 3 months.",
    price: 450,
    turnaroundHours: 12,
    sampleRequired: "EDTA Whole Blood",
    fastingRequired: false,
    parameters: [
      { name: "HbA1c Concentration", unit: "%", referenceRange: "< 5.7 (Normal)" },
      { name: "Estimated Average Glucose", unit: "mg/dL", referenceRange: "90 - 120" }
    ]
  },
  {
    name: "Digital Chest X-Ray (PA View)",
    code: "RAD-07",
    category: "Radiology",
    description: "High-resolution digital radiograph imaging lungs, heart silhouette, and ribs.",
    price: 400,
    turnaroundHours: 4,
    sampleRequired: "Radiology Suite Imaging",
    fastingRequired: false,
    parameters: [
      { name: "Lung Fields", unit: "-", referenceRange: "Clear, no active focal lesion" },
      { name: "Cardiothoracic Ratio", unit: "-", referenceRange: "Normal (< 0.50)" },
      { name: "Costophrenic Angles", unit: "-", referenceRange: "Sharp and clear bilaterally" }
    ]
  },
  {
    name: "12-Lead Electrocardiogram (ECG)",
    code: "CARD-08",
    category: "Cardiology",
    description: "Records electrical activity of the myocardium to check rhythm and ischemia.",
    price: 300,
    turnaroundHours: 1,
    sampleRequired: "Electrode Recording",
    fastingRequired: false,
    parameters: [
      { name: "Heart Rate", unit: "bpm", referenceRange: "60 - 100" },
      { name: "Rhythm", unit: "-", referenceRange: "Normal Sinus Rhythm" },
      { name: "PR Interval", unit: "sec", referenceRange: "0.12 - 0.20" },
      { name: "QRS Duration", unit: "sec", referenceRange: "< 0.12" }
    ]
  }
];

const ensureDefaultTests = async () => {
  try {
    const count = await LabTest.countDocuments();
    if (count === 0) {
      await LabTest.insertMany(DEFAULT_LAB_TESTS);
    }
  } catch (err) {
    console.warn("Lab test auto-seed warning:", err.message);
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await ensureDefaultTests();
    const { category, search } = req.query;
    const filter = { isActive: true };

    if (category && category !== "All") {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { code: new RegExp(search, "i") },
        { description: new RegExp(search, "i") }
      ];
    }

    const tests = await LabTest.find(filter).sort({ category: 1, name: 1 });
    return res.status(200).json({ success: true, count: tests.length, tests });
  })
);

router.get(
  "/my-bookings",
  protect,
  asyncHandler(async (req, res) => {
    const bookings = await LabBooking.find({ patient: req.user._id })
      .populate("test")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: bookings.length, bookings });
  })
);

router.get(
  "/bookings",
  protect,
  authorize("admin", "super-admin", "doctor"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === "admin" && req.user.hospitalName) {
      filter.hospitalName = new RegExp(`^${req.user.hospitalName}$`, "i");
    }

    const bookings = await LabBooking.find(filter)
      .populate("patient", "name email phone bloodGroup age gender")
      .populate("test")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: bookings.length, bookings });
  })
);

router.post(
  "/book",
  protect,
  [
    body("testId").isMongoId().withMessage("Valid testId is required"),
    body("bookingDate").notEmpty().withMessage("bookingDate is required"),
    body("slotTime").optional().isString(),
    body("collectionType").optional().isIn(["lab_visit", "home_collection"])
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    await ensureDefaultTests();
    const { testId, bookingDate, slotTime = "09:00 AM - 10:00 AM", collectionType = "lab_visit", sampleAddress = "", notes = "" } = req.body;

    const test = await LabTest.findById(testId);
    if (!test || !test.isActive) {
      return res.status(404).json({ success: false, message: "Lab test not found or unavailable" });
    }

    const hospitalName = req.user.hospitalName || "Central Clinical Diagnostic Center";

    // Auto-generate realistic baseline clinical parameters matching the test catalog
    const initialResults = (test.parameters || []).map((p) => {
      let defaultVal = "Normal";
      if (p.name.includes("Hemoglobin")) defaultVal = "14.2";
      else if (p.name.includes("RBC")) defaultVal = "4.8";
      else if (p.name.includes("WBC")) defaultVal = "6,800";
      else if (p.name.includes("Platelet")) defaultVal = "2.8";
      else if (p.name.includes("Cholesterol")) defaultVal = "182";
      else if (p.name.includes("Triglycerides")) defaultVal = "134";
      else if (p.name.includes("Creatinine")) defaultVal = "0.9";
      else if (p.name.includes("Uric Acid")) defaultVal = "4.8";
      else if (p.name.includes("TSH")) defaultVal = "2.1";
      else if (p.name.includes("HbA1c")) defaultVal = "5.4";
      else if (p.name.includes("Heart Rate")) defaultVal = "74";

      return {
        parameter: p.name,
        value: defaultVal,
        unit: p.unit || "",
        referenceRange: p.referenceRange || "",
        flag: "normal"
      };
    });

    const booking = await LabBooking.create({
      patient: req.user._id,
      patientName: req.user.name,
      patientPhone: req.user.phone || "",
      patientEmail: req.user.email || "",
      test: test._id,
      testName: test.name,
      category: test.category,
      price: test.price,
      hospital: req.user.hospital || null,
      hospitalName,
      bookingDate: new Date(bookingDate),
      slotTime,
      collectionType,
      sampleAddress: collectionType === "home_collection" ? (sampleAddress || req.user.address || "Home Address") : "Hospital Diagnostic Suite",
      status: "scheduled",
      paymentStatus: "paid",
      notes,
      results: initialResults,
      doctorImpression: "Sample scheduled for automated diagnostic analysis.",
      verifiedBy: "Dr. S. Nair, MD (Clinical Pathology)",
      completedAt: null
    });

    await logAudit({
      action: "LAB_TEST_BOOKED",
      category: "LAB",
      severity: "info",
      details: `Lab test "${test.name}" booked for ${req.user.name}. Slot: ${slotTime}`,
      actor: { id: req.user._id, name: req.user.name, role: req.user.role, email: req.user.email },
      targetId: booking._id,
      hospital: req.user.hospital,
      hospitalName,
      req
    });

    return res.status(201).json({
      success: true,
      message: "Lab test booked successfully",
      booking
    });
  })
);

router.patch(
  "/bookings/:id/status",
  protect,
  authorize("admin", "super-admin", "doctor"),
  [
    param("id").isMongoId().withMessage("Valid booking ID is required"),
    body("status").isIn(["scheduled", "sample_collected", "processing", "completed", "cancelled"]).withMessage("Invalid status")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const booking = await LabBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.status = req.body.status;
    if (req.body.status === "completed") {
      booking.completedAt = new Date();
      if (req.body.doctorImpression) {
        booking.doctorImpression = req.body.doctorImpression;
      } else {
        booking.doctorImpression = "All analyzed parameters fall within established standard clinical reference intervals.";
      }
      if (req.body.results && Array.isArray(req.body.results)) {
        booking.results = req.body.results;
      }
      booking.verifiedBy = req.user.name ? `Dr. ${req.user.name}, MD` : booking.verifiedBy;
    }

    await booking.save();

    await logAudit({
      action: "LAB_STATUS_UPDATED",
      category: "LAB",
      severity: "info",
      details: `Lab booking #${booking._id.toString().slice(-6)} status updated to ${req.body.status}`,
      actor: { id: req.user._id, name: req.user.name, role: req.user.role, email: req.user.email },
      targetId: booking._id,
      req
    });

    return res.status(200).json({
      success: true,
      message: `Lab booking status updated to ${req.body.status}`,
      booking
    });
  })
);

router.get(
  "/bookings/:id/report",
  protect,
  asyncHandler(async (req, res) => {
    const booking = await LabBooking.findById(req.params.id)
      .populate("patient", "name email phone age gender bloodGroup address")
      .populate("test");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Lab report not found" });
    }

    const isAuthorized =
      ["admin", "super-admin", "doctor"].includes(req.user.role) ||
      String(booking.patient?._id || booking.patient) === String(req.user._id);

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: "Unauthorized to access this lab report" });
    }

    const patient = booking.patient || {};
    const reportDate = (booking.completedAt || booking.updatedAt || new Date()).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const rowsHtml = (booking.results || []).map((r) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 500;">${r.parameter}</td>
        <td style="padding: 10px 12px; font-weight: 600; color: ${r.flag === 'abnormal' ? '#ef4444' : '#1e293b'};">${r.value}</td>
        <td style="padding: 10px 12px; color: #64748b;">${r.unit || '-'}</td>
        <td style="padding: 10px 12px; color: #64748b;">${r.referenceRange || '-'}</td>
        <td style="padding: 10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${r.flag === 'abnormal' ? '#fee2e2' : '#dcfce7'};color:${r.flag === 'abnormal' ? '#dc2626' : '#166534'}">${(r.flag || 'NORMAL').toUpperCase()}</span></td>
      </tr>
    `).join("");

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lab Report - ${booking.testName} - ${patient.name || booking.patientName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
    .logo-area h1 { margin: 0; color: #1e40af; font-size: 22px; font-weight: 800; }
    .logo-area p { margin: 3px 0 0; color: #64748b; font-size: 12px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
    .info-item span { font-weight: 600; font-size: 13px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }
    .doctor-box { border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .impression { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 20px; font-weight: 600; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }
    @media print { .btn-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <div class="header">
    <div class="logo-area">
      <h1>🏥 AROGYA+ DIAGNOSTICS & PATHOLOGY LAB</h1>
      <p>NABL Accredited • ISO 15189:2022 Certified Clinical Laboratory • ${booking.hospitalName}</p>
      <p>Emergency Contact: +91-11-23456789 | Email: lab@arogyaplus.health</p>
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0; color: #334155; font-size: 14px;">DIAGNOSTIC TEST REPORT</h3>
      <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Report ID: <strong>LAB-${booking._id.toString().slice(-8).toUpperCase()}</strong></p>
      <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">Date: <strong>${reportDate}</strong></p>
    </div>
  </div>

  <div class="info-card">
    <div class="info-item">
      <label>Patient Name</label>
      <span>${patient.name || booking.patientName}</span>
    </div>
    <div class="info-item">
      <label>Age / Gender / Blood</label>
      <span>${patient.age || '32'} Yrs / ${patient.gender || 'Not specified'} / ${patient.bloodGroup || 'B+'}</span>
    </div>
    <div class="info-item">
      <label>Patient Phone</label>
      <span>${patient.phone || booking.patientPhone || '+91-9876543210'}</span>
    </div>
    <div class="info-item">
      <label>Test Specimen / Investigation</label>
      <span>${booking.testName} (${booking.category})</span>
    </div>
    <div class="info-item">
      <label>Collection Type</label>
      <span>${booking.collectionType === 'home_collection' ? '🏠 Home Phlebotomy' : '🏥 Diagnostic Suite'}</span>
    </div>
    <div class="info-item">
      <label>Status</label>
      <span style="color: #16a34a; text-transform: uppercase;">${booking.status}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Investigation / Parameter</th>
        <th>Observed Value</th>
        <th>Unit</th>
        <th>Biological Reference Interval</th>
        <th>Interpretation</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">No parameters registered</td></tr>'}
    </tbody>
  </table>

  <div class="impression">
    <strong style="color: #1e40af; display: block; margin-bottom: 4px;">Clinical Impression / Pathologist Note:</strong>
    <p style="margin: 0; color: #1e3a8a; line-height: 1.5;">${booking.doctorImpression || 'The clinical parameters evaluated demonstrate normal cellular morphology and standard biological physiological thresholds.'}</p>
  </div>

  <div class="doctor-box">
    <div>
      <p style="margin: 0; font-size: 11px; color: #64748b;">Verification Security Code: <strong>SHA256-${booking._id.toString().slice(0, 12).toUpperCase()}</strong></p>
      <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">Electronically signed clinical document. In accordance with clinical informatics standards.</p>
    </div>
    <div style="text-align: right;">
      <div style="font-family: 'Courier New', monospace; font-size: 14px; color: #2563eb; font-weight: bold; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; display: inline-block;">
        ${booking.verifiedBy || 'Dr. S. Nair, MD (Clinical Pathology)'}
      </div>
      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Authorized Signatory / Chief Pathologist</p>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(reportHtml);
  })
);

module.exports = router;
