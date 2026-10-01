const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param } = require("express-validator");
const Emergency = require("../models/Emergency");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const { getEmergencyQueue, emitEmergencyQueueUpdate } = require("../utils/emergencyQueue");

const router = express.Router();

router.post(
  "/",
  protect,
  [
    body("patientName").trim().notEmpty().withMessage("Patient name is required"),
    body("contact").trim().notEmpty().withMessage("Contact number is required"),
    body("location").trim().notEmpty().withMessage("Location is required"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high", "critical"])
      .withMessage("Invalid priority value"),
    body("symptoms").optional().isArray().withMessage("Symptoms must be an array")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      patientName,
      contact,
      location,
      priority,
      symptoms = [],
      bookedFor = "self",
      familyMemberId = null,
      relationship = "",
      locationType = "current",
      latitude,
      longitude
    } = req.body;

    const { analyzeSymptoms } = require("../utils/aiEngine");
    const aiAssessment = analyzeSymptoms({ symptoms, additionalNotes: location });

    const emergency = await Emergency.create({
      patientName,
      contact,
      bookedFor: bookedFor === "family" ? "family" : "self",
      familyMemberId: familyMemberId || null,
      relationship: relationship || (bookedFor === "family" ? "Family" : "Self"),
      locationType: locationType || (bookedFor === "family" ? "remote_saved" : "current"),
      location,
      latitude: Number(latitude) || 28.6139,
      longitude: Number(longitude) || 77.2090,
      priority: priority || aiAssessment.urgencyLevel || "medium",
      symptoms,
      aiAssessment: {
        triageLevel: aiAssessment.urgencyLevel,
        recommendations: [aiAssessment.advice, aiAssessment.diagnosisHint],
        emergencyCategory: aiAssessment.predictedSpecialty
      },
      createdBy: req.user._id
    });

    await emitEmergencyQueueUpdate(req.io);

    return res.status(201).json({
      success: true,
      message: "Emergency request created",
      emergency
    });
  })
);

router.get(
  "/queue",
  protect,
  asyncHandler(async (req, res) => {
    const queue = await getEmergencyQueue();
    return res.status(200).json({ success: true, queue });
  })
);

router.get(
  "/my",
  protect,
  asyncHandler(async (req, res) => {
    const emergencies = await Emergency.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, emergencies });
  })
);

router.patch(
  "/:id/status",
  protect,
  authorize("doctor", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid emergency id is required"),
    body("status")
      .isIn(["waiting", "in_progress", "resolved"])
      .withMessage("Invalid emergency status"),
    body("assignedDoctor").optional().isMongoId().withMessage("assignedDoctor must be valid user id")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    emergency.status = req.body.status;
    if (req.body.assignedDoctor) {
      emergency.assignedDoctor = req.body.assignedDoctor;
    } else if (req.user.role === "doctor") {
      emergency.assignedDoctor = req.user._id;
    }

    await emergency.save();
    await emitEmergencyQueueUpdate(req.io);

    return res.status(200).json({
      success: true,
      message: "Emergency status updated",
      emergency
    });
  })
);

module.exports = router;
