const express = require("express");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Hospital = require("../models/Hospital");
const {
  analyzeSymptoms,
  autoMatchDoctor,
  autoDispatchAmbulance,
  autoAllocateFacility,
  autoHandleEmergency,
  haversineDistanceKm
} = require("../utils/aiEngine");

const router = express.Router();

const generateAppointmentToken = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100).toString();
  return `AI-APT-${timestamp}-${random}`;
};

const sanitizePatientLocation = (loc, fallbackUser = null, fallbackCoords = null) => {
  const address = loc && typeof loc === "object" && typeof loc.address === "string" ? loc.address.trim() : (fallbackUser?.address || "");
  const city = loc && typeof loc === "object" && typeof loc.city === "string" ? loc.city.trim() : (fallbackUser?.city || "");

  const rawCoords = (loc && typeof loc === "object" && loc.coordinates) || fallbackCoords || fallbackUser?.coordinates;
  let cleanCoords = undefined;
  if (rawCoords && typeof rawCoords === "object") {
    const lat = Number(rawCoords.lat !== undefined ? rawCoords.lat : rawCoords.latitude);
    const lng = Number(rawCoords.lng !== undefined ? rawCoords.lng : rawCoords.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      cleanCoords = { lat, lng };
    }
  }

  const result = { address, city };
  if (cleanCoords) {
    result.coordinates = cleanCoords;
  }
  return result;
};

const sanitizePatientDetails = (details, fallbackUser = null, defaultAge = 30) => {
  const name = (details && typeof details === "object" && details.name) || fallbackUser?.name || "Patient";
  const relationship = (details && typeof details === "object" && details.relationship) || "Self";
  const phone = (details && typeof details === "object" && details.phone) || fallbackUser?.phone || "";
  const bloodGroup = (details && typeof details === "object" && details.bloodGroup) || fallbackUser?.bloodGroup || "Unknown";

  const rawAge = (details && typeof details === "object" && details.age !== undefined) ? details.age : (fallbackUser?.age !== undefined ? fallbackUser.age : defaultAge);
  const ageNum = Number(rawAge);
  const age = Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130 ? ageNum : undefined;

  const rawGender = String((details && typeof details === "object" && details.gender) || fallbackUser?.gender || "other").trim().toLowerCase();
  const gender = ["male", "female", "other"].includes(rawGender) ? rawGender : "other";

  const result = { name, relationship, phone, bloodGroup, gender };
  if (age !== undefined) result.age = age;
  return result;
};

// ==========================================
// 1. AI CLINICAL SYMPTOM & TRIAGE ANALYZER
// ==========================================
router.post(
  "/triage",
  protect,
  [
    body("symptoms").optional(),
    body("disease").optional({ nullable: true }).isString().withMessage("Disease must be a string"),
    body("age").optional({ nullable: true }).isNumeric().withMessage("Age must be a number")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { symptoms = [], disease = "", age = 30, additionalNotes = "" } = req.body;
    const triage = analyzeSymptoms({ symptoms, disease, age, additionalNotes });

    return res.status(200).json({
      success: true,
      triage
    });
  })
);

// ==========================================
// 2. AUTONOMOUS DOCTOR AUTO-ASSIGN & MATCH
// ==========================================
router.post(
  "/auto-assign-doctor",
  protect,
  [
    body("symptoms").optional(),
    body("disease").optional({ nullable: true }).isString().withMessage("Disease must be a string"),
    body("specialty").optional({ nullable: true }).isString().withMessage("Specialty must be a string"),
    body("coordinates").optional({ nullable: true, checkFalsy: true }).custom((val) => {
      if (val === null || val === undefined || val === "") return true;
      if (typeof val === "object") return true;
      throw new Error("Coordinates must be an object or null");
    }),
    body("autoBook").optional({ nullable: true }).isBoolean().withMessage("autoBook must be a boolean"),
    body("bookedFor").optional({ nullable: true }).isIn(["self", "family"]).withMessage("bookedFor must be self or family"),
    body("familyMemberId").optional({ nullable: true }),
    body("appointmentDate").optional({ nullable: true }),
    body("locationType")
      .optional({ nullable: true })
      .isIn(["current", "remote_saved", "custom_remote", "hospital"])
      .withMessage("Invalid locationType"),
    body("patientLocation").optional({ nullable: true }),
    body("patientDetails").optional({ nullable: true })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      symptoms = [],
      disease = "",
      specialty = "",
      coordinates = null,
      hospitalName = "",
      age = 30,
      autoBook = false,
      bookedFor = "self",
      familyMemberId = null,
      patientDetails = null,
      appointmentDate = null,
      reason = "",
      consultationType = "in_person",
      locationType = "current",
      patientLocation = null
    } = req.body;

    // Run AI Doctor Matching Engine
    const matchResult = await autoMatchDoctor({
      symptoms,
      disease,
      specialty,
      patientCoordinates: coordinates,
      patientLocation,
      hospitalName,
      age
    });

    if (!matchResult.success || !matchResult.matchedDoctor) {
      return res.status(404).json({
        success: false,
        message: matchResult.message || "No suitable doctor found for the specified clinical condition.",
        triage: matchResult.triage
      });
    }

    // If autoBook is requested, automatically create the appointment
    if (autoBook) {
      const doctor = matchResult.matchedDoctor;
      const targetDate = appointmentDate ? new Date(appointmentDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const triage = matchResult.triage || analyzeSymptoms({ symptoms, disease, age });

      const cleanDetails = sanitizePatientDetails(patientDetails, req.user, age);
      const cleanLocation = sanitizePatientLocation(patientLocation, req.user, coordinates);
      const cleanLocType = ["current", "remote_saved", "custom_remote", "hospital"].includes(locationType) ? locationType : "current";

      const appointment = await Appointment.create({
        patient: req.user._id,
        doctor: doctor._id,
        hospital: doctor.hospital || null,
        hospitalName: doctor.hospitalName || "",
        appointmentDate: targetDate,
        reason: reason || disease || (Array.isArray(symptoms) ? symptoms.join(", ") : "AI Consultation") || "General Consultation",
        consultationType: consultationType === "video" ? "video" : "in_person",
        tokenNumber: generateAppointmentToken(),
        status: "confirmed",
        bookedFor: bookedFor === "family" ? "family" : "self",
        familyMemberId: familyMemberId || null,
        patientDetails: cleanDetails,
        locationType: cleanLocType,
        patientLocation: cleanLocation,
        aiTriage: {
          symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
          predictedSpecialty: matchResult.targetSpecialty,
          urgencyLevel: triage?.urgencyLevel || "medium",
          diagnosisHint: triage?.diagnosisHint || "",
          autoAssigned: true,
          confidence: triage?.confidence || 0.92
        }
      });

      const populated = await Appointment.findById(appointment._id)
        .populate("patient", "name email phone")
        .populate("doctor", "name email phone specialization consultationFee clinicAddress hospitalName");

      const doctorDisplayName = /^dr\.?\s+/i.test(doctor.name) ? doctor.name : `Dr. ${doctor.name}`;
      return res.status(201).json({
        success: true,
        message: `${doctorDisplayName} (${doctor.specialization}) was autonomously matched and booked!`,

        appointment: populated,
        matchDetails: {
          matchScore: matchResult.matchScore,
          distanceKm: matchResult.distanceKm,
          isFree: matchResult.isFree,
          explanation: matchResult.explanation
        }
      });
    }

    return res.status(200).json({
      success: true,
      ...matchResult
    });
  })
);

// ==========================================
// 3. AUTONOMOUS AMBULANCE AUTO-DISPATCH
// ==========================================
router.post(
  "/auto-dispatch-ambulance",
  protect,
  [
    body("pickupLocation").trim().notEmpty().withMessage("Pickup location is required"),
    body("pickupCoordinates").optional({ nullable: true, checkFalsy: true }).custom((val) => {
      if (val === null || val === undefined || val === "") return true;
      if (typeof val === "object") return true;
      throw new Error("Pickup coordinates must be an object or null");
    }),
    body("priority").optional({ nullable: true }).isIn(["low", "medium", "high", "critical"]).withMessage("Priority must be low, medium, high, or critical"),
    body("bookedFor").optional({ nullable: true }).isIn(["self", "family"]).withMessage("bookedFor must be self or family")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      pickupLocation,
      pickupCoordinates,
      priority = "high",
      problemDescription = "Emergency assistance requested",
      bookedFor = "self",
      familyMemberId = null,
      patientDetails = null,
      locationType = "current"
    } = req.body;

    const dispatchResult = await autoDispatchAmbulance({
      pickupCoordinates,
      pickupLocation,
      problemDescription,
      requestedById: req.user._id,
      bookedFor,
      familyMemberId,
      patientDetails,
      priority,
      io: req.io
    });

    if (!dispatchResult.success) {
      return res.status(503).json(dispatchResult);
    }

    return res.status(201).json(dispatchResult);
  })
);

// ==========================================
// 4. AUTONOMOUS ALL-IN-ONE EMERGENCY RESPONDER
// ==========================================
router.post(
  "/emergency-auto-respond",
  protect,
  [
    body("patientName").trim().notEmpty().withMessage("Patient name is required"),
    body("contact").trim().notEmpty().withMessage("Contact is required"),
    body("location").trim().notEmpty().withMessage("Location is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      patientName,
      contact,
      symptoms = [],
      location,
      coordinates = null,
      bookedFor = "self",
      familyMemberId = null,
      relationship = ""
    } = req.body;

    const emergencyResult = await autoHandleEmergency({
      requestedById: req.user._id,
      patientName,
      contact,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
      location,
      coordinates,
      bookedFor,
      familyMemberId,
      relationship,
      io: req.io
    });

    return res.status(201).json(emergencyResult);
  })
);

// ==========================================
// 5. REMOTE PLACE FACILITY & DOCTOR LOCATOR
// ==========================================
router.post(
  "/locate-facilities",
  protect,
  asyncHandler(async (req, res) => {
    const { coordinates = null, city = "", specialty = "" } = req.body;

    const hospitalQuery = { emergencyServices: true };
    if (city) {
      hospitalQuery.city = new RegExp(`^${city.trim()}$`, "i");
    }

    const hospitals = await Hospital.find(hospitalQuery);

    const scoredHospitals = hospitals.map((h) => {
      let distanceKm = 10;
      if (coordinates) {
        const hCoords = h.location?.coordinates
          ? { lat: h.location.coordinates[1], lng: h.location.coordinates[0] }
          : { lat: h.latitude, lng: h.longitude };
        const d = haversineDistanceKm(coordinates, hCoords);
        if (d !== null) distanceKm = d;
      }
      return {
        id: h._id,
        name: h.name,
        address: h.address,
        city: h.city,
        totalBeds: h.totalBeds,
        availableBeds: h.availableBeds,
        icuAvailable: h.icuBeds?.available || 0,
        oxygenAvailable: h.oxygenBeds?.available || 0,
        distanceKm: Number(distanceKm.toFixed(1)),
        ambulanceContact: h.ambulanceContact,
        rating: h.rating
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    // Nearby doctors
    const doctorQuery = { role: "doctor", isActive: true };
    if (specialty) {
      doctorQuery.specialization = new RegExp(specialty.trim(), "i");
    }

    const doctors = await User.find(doctorQuery).select(
      "name specialization consultationFee clinicAddress clinicCoordinates hospitalName rating experienceYears isAvailable"
    );

    const scoredDoctors = doctors.map((doc) => {
      let distanceKm = null;
      if (coordinates && doc.clinicCoordinates?.lat) {
        distanceKm = haversineDistanceKm(coordinates, doc.clinicCoordinates);
      }
      return {
        id: doc._id,
        name: doc.name,
        specialization: doc.specialization,
        fee: doc.consultationFee,
        clinicAddress: doc.clinicAddress,
        hospitalName: doc.hospitalName,
        rating: doc.rating,
        distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(1)) : null,
        isAvailable: doc.isAvailable
      };
    }).sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return (b.rating || 0) - (a.rating || 0);
    });

    return res.status(200).json({
      success: true,
      hospitals: scoredHospitals,
      doctors: scoredDoctors.slice(0, 10),
      count: {
        hospitals: scoredHospitals.length,
        doctors: scoredDoctors.length
      }
    });
  })
);

module.exports = router;
