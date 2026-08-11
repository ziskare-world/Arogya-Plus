const express = require("express");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateMiddleware");
const { buildSymptomAssessment } = require("../utils/symptomChecker");

const router = express.Router();

router.post(
  "/symptom-checker",
  [
    body("symptoms").isArray({ min: 1 }).withMessage("symptoms must be a non-empty array"),
    body("symptoms.*").isString().withMessage("Each symptom must be a string"),
    body("age").optional().isInt({ min: 0, max: 120 }).withMessage("Age must be between 0 and 120")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const assessment = buildSymptomAssessment({
      symptoms: req.body.symptoms,
      age: req.body.age || 30
    });

    return res.status(200).json({
      success: true,
      message: "AI symptom assessment completed",
      assessment,
      disclaimer:
        "This tool is informational and not a substitute for professional medical diagnosis."
    });
  })
);

router.post(
  "/chat",
  [
    body("message").isString().trim().notEmpty().withMessage("Message is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const userMsg = req.body.message.trim();
    const lower = userMsg.toLowerCase();

    // Check for red flag emergency keywords
    const redFlags = ["chest pain", "shortness of breath", "unconscious", "seizure", "heavy bleeding", "stroke", "heart attack", "can't breathe"];
    const matchedRedFlags = redFlags.filter(rf => lower.includes(rf));

    let reply = "";
    let action = null;
    let triageLevel = "normal";

    if (matchedRedFlags.length > 0) {
      triageLevel = "critical";
      reply = `⚠️ **CRITICAL MEDICAL ALERT**: I detected severe symptoms (${matchedRedFlags.join(", ")}). Please seek immediate emergency medical care or request an urgent ambulance right now!`;
      action = {
        label: "🚑 Dispatch Ambulance Now",
        href: "ambulance-booking.html",
        variant: "danger"
      };
    } else if (lower.includes("symptom") || lower.includes("fever") || lower.includes("headache") || lower.includes("pain") || lower.includes("cough") || lower.includes("sick") || lower.includes("stomach")) {
      // Extract symptoms roughly
      const sampleSymptoms = [];
      if (lower.includes("fever")) sampleSymptoms.push("high fever");
      if (lower.includes("headache")) sampleSymptoms.push("severe headache");
      if (lower.includes("cough")) sampleSymptoms.push("persistent cough");
      if (lower.includes("stomach") || lower.includes("abdominal")) sampleSymptoms.push("abdominal pain");
      if (lower.includes("vomit")) sampleSymptoms.push("vomiting");

      if (sampleSymptoms.length > 0) {
        const assessment = buildSymptomAssessment({ symptoms: sampleSymptoms });
        triageLevel = assessment.triageLevel;
        reply = `Based on your symptoms (${sampleSymptoms.join(", ")}), the triage assessment is **${triageLevel.toUpperCase()}**. ${assessment.recommendation}`;
        action = {
          label: "📅 Consult a Doctor",
          href: "doctors.html",
          variant: "primary"
        };
      } else {
        reply = `I can help evaluate your symptoms! Please describe your symptoms (e.g. fever, headache, cough, body pain) or click below to book a doctor consultation.`;
        action = {
          label: "🩺 Find & Book Doctor",
          href: "doctors.html",
          variant: "primary"
        };
      }
    } else if (lower.includes("appointment") || lower.includes("book") || lower.includes("doctor")) {
      reply = `You can easily schedule or manage your doctor appointments from the Appointments portal. You can view available specialists, pick date & time slots, and track appointment status.`;
      action = {
        label: "📅 Go to Appointments",
        href: "appointments.html",
        variant: "primary"
      };
    } else if (lower.includes("ambulance") || lower.includes("emergency") || lower.includes("sos")) {
      reply = `For emergency response, our 24/7 Ambulance SOS service provides live GPS dispatch to nearest hospitals.`;
      action = {
        label: "🚑 Open Ambulance Booking",
        href: "ambulance-booking.html",
        variant: "danger"
      };
    } else if (lower.includes("record") || lower.includes("ehr") || lower.includes("history") || lower.includes("lab")) {
      reply = `Your electronic medical records (EHR), past visit notes, and lab reports are securely accessible in your Medical Records section.`;
      action = {
        label: "📋 View Medical Records",
        href: "medical-records.html",
        variant: "primary"
      };
    } else if (lower.includes("prescription") || lower.includes("medicine") || lower.includes("refill")) {
      reply = `Check your active prescriptions, dosage guidelines, and digital Rx files issued by your doctors.`;
      action = {
        label: "💊 Open Prescriptions",
        href: "prescriptions.html",
        variant: "primary"
      };
    } else if (lower.includes("pay") || lower.includes("bill") || lower.includes("balance") || lower.includes("cost") || lower.includes("fee")) {
      reply = `Manage your clinical bills, outstanding balance, and Razorpay payment history seamlessly.`;
      action = {
        label: "💳 Open Billing & Payments",
        href: "payments.html",
        variant: "primary"
      };
    } else if (lower.includes("hi") || lower.includes("hello") || lower.includes("hey") || lower.includes("help")) {
      reply = `Hello! I am your **Arogya AI Health Assistant**. How can I help you today? You can ask me about symptom checks, booking doctors, emergency ambulances, or accessing your health records!`;
    } else {
      reply = `Thank you for reaching out! I'm your Arogya AI Health Assistant. I can assist with symptom assessment, finding specialists, emergency ambulance requests, and navigating your medical records. What would you like help with?`;
    }

    return res.status(200).json({
      success: true,
      reply,
      triageLevel,
      action,
      disclaimer: "Arogya AI provides clinical information for reference and does not replace medical advice from a certified physician."
    });
  })
);

module.exports = router;
