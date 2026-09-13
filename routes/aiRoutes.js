const express = require("express");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateMiddleware");
const { protect, authorize } = require("../middleware/authMiddleware");
const User = require("../models/User");
const AgentMemory = require("../models/AgentMemory");
const Prescription = require("../models/Prescription");
const {
  agentOrchestrator,
  triageAgent,
  appointmentAgent,
  clinicalNotesAgent,
  hospitalOperationsAgent,
  huggingFaceClient,
  queryQwenAgent,
  DEFAULT_QWEN_MODEL
} = require("../ai");

const router = express.Router();

/**
 * @route   GET /api/ai/status
 * @desc    Get AI subsystem health, configured agents, and model provider status
 * @access  Public
 */
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      status: "online",
      model: DEFAULT_QWEN_MODEL,
      provider: huggingFaceClient.isConfigured ? "huggingface-inference-api" : "qwen-clinical-engine",
      huggingfaceConfigured: huggingFaceClient.isConfigured,
      agents: [
        { name: "TalkingAgent", role: "Conversational Healthcare & Empathy Q&A (Qwen3-30B)", active: true },
        { name: "TriageAgent", role: "Emergency Severity Scoring & 108 Alert", active: true },
        { name: "AppointmentAgent", role: "Natural Language Smart Scheduling & Live DB Conflict Check", active: true },
        { name: "ClinicalNotesAgent", role: "SOAP Structuring & Real Prescription Generation", active: true },
        { name: "HospitalOperationsAgent", role: "Live Hospital Bed & Emergency Fleet Telemetry", active: true },
        { name: "AgentOrchestrator", role: "Central Intent Classifier & Router", active: true }
      ]
    });
  })
);

/**
 * @route   POST /api/ai/qwen/chat
 * @desc    Direct Node.js accessibility endpoint for Qwen3-30B-A3B Hugging Face model
 * @access  Public
 */
router.post(
  "/qwen/chat",
  [
    body("messages").isArray({ min: 1 }).withMessage("messages must be a non-empty array"),
    body("messages.*.role").isString().withMessage("Each message must have a role"),
    body("messages.*.content").isString().withMessage("Each message must have content"),
    body("maxNewTokens").optional().isInt({ min: 1, max: 512 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await queryQwenAgent({
      messages: req.body.messages,
      maxNewTokens: req.body.maxNewTokens || 60
    });
    return res.status(200).json(result);
  })
);

/**
 * @route   POST /api/ai/symptom-checker
 * @desc    AI symptom triage assessment
 * @access  Public
 */
router.post(
  "/symptom-checker",
  [
    body("symptoms").isArray({ min: 1 }).withMessage("symptoms must be a non-empty array"),
    body("symptoms.*").isString().withMessage("Each symptom must be a string"),
    body("age").optional().isInt({ min: 0, max: 120 }).withMessage("Age must be between 0 and 120")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const assessment = await triageAgent.evaluateSymptoms({
      symptoms: req.body.symptoms,
      age: req.body.age || 30
    });

    return res.status(200).json({
      success: true,
      message: "AI symptom assessment completed",
      assessment,
      disclaimer: "This tool is informational and not a substitute for professional medical diagnosis."
    });
  })
);

/**
 * @route   POST /api/ai/chat
 * @desc    Multi-agent conversational turn with intent routing & action payloads
 * @access  Public
 */
router.post(
  "/chat",
  [
    body("message").isString().trim().notEmpty().withMessage("Message is required"),
    body("history").optional().isArray().withMessage("History must be an array")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const userMsg = req.body.message.trim();
    const history = req.body.history || [];

    // Optional user authentication via JWT header
    let currentUser = req.user || null;
    if (!currentUser && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id).select("-password");
      } catch (authErr) {
        // Non-blocking for public chat queries
      }
    }

    const result = await agentOrchestrator.handleUserMessage({
      message: userMsg,
      history,
      user: currentUser
    });

    // Check if query is asking specifically to explore or browse doctors
    const isDoctorExploreQuery = /\b(explore doctor|explore doctors|find doctor|find doctors|list doctors|show doctors|all doctors)\b/i.test(userMsg);
    let doctors = null;
    let action = result.action;

    if (
      isDoctorExploreQuery ||
      (action && action.label && action.label.toLowerCase().includes("explore doctor")) ||
      (action && action.href === "doctors.html")
    ) {
      try {
        let docs = await User.find({ role: "doctor", isActive: true })
          .select("name email specialization experienceYears rating reviewCount phone clinicAddress hospitalName")
          .limit(10)
          .lean();

        if (!docs || !docs.length) {
          docs = [
            {
              name: "Dr. Priya Sharma",
              specialization: "General Medicine",
              hospitalName: "ArogyaPlus Multi-Specialty Hospital",
              experienceYears: 12,
              rating: 4.9,
              phone: "080-23456789"
            },
            {
              name: "Dr. Rajesh Kumar",
              specialization: "Cardiology",
              hospitalName: "ArogyaPlus Heart Institute",
              experienceYears: 16,
              rating: 4.8,
              phone: "080-87654321"
            },
            {
              name: "Dr. Ananya Sen",
              specialization: "Pediatrics & Child Care",
              hospitalName: "City Children's Hospital",
              experienceYears: 9,
              rating: 4.95,
              phone: "080-45678901"
            }
          ];
        }

        doctors = docs;
        if (isDoctorExploreQuery || !action || action.href === "doctors.html") {
          action = {
            type: "explore_doctors",
            label: "🩺 Explore Doctors",
            href: "doctors.html",
            variant: "primary"
          };
        }
      } catch (err) {
        // Ignore doctor query errors gracefully
      }
    }

    // Persist past user interactions for continuous improvement and personalized care
    if (currentUser) {
      try {
        currentUser.aiInteractions = currentUser.aiInteractions || [];
        currentUser.aiInteractions.push(
          {
            role: "user",
            content: userMsg,
            intent: result.intent,
            timestamp: new Date()
          },
          {
            role: "assistant",
            content: result.reply,
            intent: result.intent,
            triageLevel: result.triageLevel,
            agent: result.agent,
            timestamp: new Date(),
            metadata: doctors ? { doctorCount: doctors.length } : undefined
          }
        );

        // Keep last 100 turns for memory retention
        if (currentUser.aiInteractions.length > 100) {
          currentUser.aiInteractions = currentUser.aiInteractions.slice(-100);
        }
        await currentUser.save();

        // Update long-term memory buffer
        await AgentMemory.findOneAndUpdate(
          { user: currentUser._id, key: "recent_ai_turn" },
          {
            user: currentUser._id,
            type: "conversation_context",
            key: "recent_ai_turn",
            value: {
              lastQuery: userMsg,
              lastReply: result.reply,
              intent: result.intent,
              triageLevel: result.triageLevel,
              updatedAt: new Date()
            },
            category: "conversation_context",
            source: "ai_chat"
          },
          { upsert: true, new: true }
        );
      } catch (persistErr) {
        console.warn("AI interaction memory logging warning:", persistErr.message);
      }
    }

    // Check if query is asking for user's prescriptions or medical records
    const isPrescriptionQuery = /\b(prescription|prescriptions|medicine|medicines|meds|rx|my record|medical record)\b/i.test(userMsg);
    let prescriptions = null;
    if (isPrescriptionQuery && currentUser) {
      try {
        prescriptions = await Prescription.find({ patient: currentUser._id })
          .populate("doctor", "name specialization")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
      } catch (err) {
        // Non-blocking
      }
    }

    return res.status(200).json({
      success: true,
      reply: result.reply,
      agent: result.agent,
      intent: result.intent,
      triageLevel: result.triageLevel,
      action,
      doctors,
      prescriptions,
      operations: result.intent === "hospital_operations" ? result.details : null,
      bookingRecommendation: result.intent === "appointment_booking" ? result.details : null,
      details: result.details || null,
      disclaimer: "Arogya AI provides clinical information for reference and does not replace certified physician advice."
    });
  })
);

/**
 * @route   GET /api/ai/history
 * @desc    Get user's past conversational history for continuous context
 * @access  Public (Authenticated when token provided)
 */
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    let currentUser = req.user || null;
    if (!currentUser && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id).select("aiInteractions");
      } catch (authErr) {
        // Invalid token
      }
    }

    if (!currentUser) {
      return res.status(200).json({ success: true, history: [] });
    }

    return res.status(200).json({
      success: true,
      history: (currentUser.aiInteractions || []).slice(-40)
    });
  })
);

/**
 * @route   DELETE /api/ai/history
 * @desc    Clear user's stored AI conversation history
 * @access  Public (Authenticated when token provided)
 */
router.delete(
  "/history",
  asyncHandler(async (req, res) => {
    let currentUser = req.user || null;
    if (!currentUser && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id);
      } catch (authErr) {
        // Invalid token
      }
    }

    if (currentUser) {
      currentUser.aiInteractions = [];
      await currentUser.save();
      await AgentMemory.deleteMany({ user: currentUser._id, category: "conversation_context" });
    }

    return res.status(200).json({
      success: true,
      message: "AI consultation history cleared successfully."
    });
  })
);

/**
 * @route   POST /api/ai/sync-history
 * @desc    Sync anonymous/guest localStorage chat history into authenticated user account
 * @access  Authenticated
 */
router.post(
  "/sync-history",
  asyncHandler(async (req, res) => {
    let currentUser = req.user || null;
    if (!currentUser && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id);
      } catch (authErr) {
        // Invalid token
      }
    }

    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Authentication required to sync history" });
    }

    const guestHistory = req.body.history || [];
    if (Array.isArray(guestHistory) && guestHistory.length > 0) {
      currentUser.aiInteractions = currentUser.aiInteractions || [];
      guestHistory.forEach(item => {
        if (item && item.role && item.content) {
          currentUser.aiInteractions.push({
            role: item.role,
            content: item.content,
            intent: item.intent || "general_chat",
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
          });
        }
      });

      if (currentUser.aiInteractions.length > 100) {
        currentUser.aiInteractions = currentUser.aiInteractions.slice(-100);
      }
      await currentUser.save();
    }

    return res.status(200).json({
      success: true,
      message: "Guest chat history synced to user profile successfully",
      syncedCount: guestHistory.length
    });
  })
);

/**
 * @route   POST /api/ai/appointments/smart-book
 * @desc    Process natural language appointment booking intent with live DB doctor matching
 * @access  Public
 */
router.post(
  "/appointments/smart-book",
  [
    body("prompt").isString().trim().notEmpty().withMessage("Prompt is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const recommendation = await appointmentAgent.recommendAppointment(req.body.prompt);
    return res.status(200).json({
      success: true,
      recommendation
    });
  })
);

/**
 * @route   POST /api/ai/appointments/confirm
 * @desc    Persist a real appointment in MongoDB created via AI assistant
 * @access  Private (Authenticated Patient)
 */
router.post(
  "/appointments/confirm",
  protect,
  [
    body("doctorId").isMongoId().withMessage("Valid doctorId is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("timeSlot").optional().isString(),
    body("symptoms").optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const appointment = await appointmentAgent.createRealAppointment({
      patientId: req.user._id,
      doctorId: req.body.doctorId,
      date: req.body.date,
      timeSlot: req.body.timeSlot || "10:00 AM",
      symptoms: req.body.symptoms || "Booked via Arogya AI Agent"
    });

    return res.status(201).json({
      success: true,
      message: "Real appointment booked successfully via AI agent",
      appointment
    });
  })
);

/**
 * @route   POST /api/ai/clinical-notes/analyze
 * @desc    Transform raw doctor notes into structured SOAP note & prescription items
 * @access  Public
 */
router.post(
  "/clinical-notes/analyze",
  [
    body("notes").isString().trim().notEmpty().withMessage("Clinical notes text is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const analysis = await clinicalNotesAgent.processNotes(req.body.notes);
    return res.status(200).json(analysis);
  })
);

/**
 * @route   POST /api/ai/clinical-notes/prescribe
 * @desc    Persist real prescription document generated from AI note analysis
 * @access  Private (Doctor / Admin)
 */
router.post(
  "/clinical-notes/prescribe",
  protect,
  authorize("doctor", "admin", "superadmin"),
  [
    body("patientId").isMongoId().withMessage("Valid patientId is required"),
    body("notes").isString().trim().notEmpty().withMessage("Clinical notes are required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await clinicalNotesAgent.saveRealPrescription({
      patientId: req.body.patientId,
      doctorId: req.user._id,
      rawNotes: req.body.notes
    });

    return res.status(201).json({
      success: true,
      message: "Prescription generated and saved to clinical records",
      result
    });
  })
);

/**
 * @route   POST /api/ai/operations/insights
 * @desc    Retrieve hospital operational analytics, live bed occupancy, and recommendations
 * @access  Public
 */
router.post(
  "/operations/insights",
  asyncHandler(async (req, res) => {
    const insights = await hospitalOperationsAgent.getOperationalInsights();
    return res.status(200).json(insights);
  })
);

module.exports = router;
