const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const Ambulance = require("../models/Ambulance");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();
const ACTIVE_DOCTOR_APPOINTMENT_STATUSES = ["pending", "confirmed"];
const DOCTOR_BUSY_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const DOCTOR_BUSY_WINDOW_AFTER_MS = 60 * 60 * 1000;
const DOCTOR_LOAD_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeCoordinates = (coords) => {
  if (!coords || typeof coords !== "object") return undefined;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
};

const normalizeText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const haversineDistanceMeters = (from, to) => {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLatRad = (from.lat * Math.PI) / 180;
  const toLatRad = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const canManageAmbulanceFleet = (user = {}) => {
  if (user?.role === "super-admin") return true;
  const level = String(user?.accessLevel || "").trim().toLowerCase();
  return level === "operations" || level === "full";
};

const requesterHospitalRegex = (user = {}) => {
  const hospitalName = String(user?.hospitalName || "").trim();
  if (!hospitalName) return null;
  return new RegExp(`^${escapeRegex(hospitalName)}$`, "i");
};

const hasBookingAccess = (user = {}, booking = {}) => {
  if (user.role === "super-admin") return true;
  if (user.role === "patient") {
    return String(booking.requestedBy || "") === String(user._id || "");
  }
  if (user.role === "doctor") {
    const assignedDoctorId = String(booking.assignedDoctor || "");
    if (!assignedDoctorId) return true;
    return assignedDoctorId === String(user._id || "");
  }
  if (user.role === "admin") {
    const hospitalRegex = requesterHospitalRegex(user);
    if (!hospitalRegex) return true;
    return (
      hospitalRegex.test(String(booking.hospitalName || "")) ||
      hospitalRegex.test(String(booking.hospitalLocation || ""))
    );
  }
  return false;
};

const PROBLEM_TO_SPECIALIZATION_RULES = [
  {
    keywords: ["chest pain", "heart", "cardiac", "palpitation", "blood pressure", "bp"],
    specializationHints: ["cardio", "cardiac", "cardiology", "internal medicine"]
  },
  {
    keywords: ["stroke", "seizure", "migraine", "headache", "dizziness", "neurology"],
    specializationHints: ["neuro", "neurology", "neurosurgery", "internal medicine"]
  },
  {
    keywords: ["fracture", "bone", "joint", "sprain", "orthopedic", "injury"],
    specializationHints: ["ortho", "orthopedic", "trauma", "surgery"]
  },
  {
    keywords: ["pregnancy", "women", "period", "gyne", "gynae", "obstetric"],
    specializationHints: ["gyn", "obstetric", "gynecology", "women"]
  },
  {
    keywords: ["breath", "asthma", "cough", "lung", "respiratory"],
    specializationHints: ["pulmo", "respiratory", "chest", "internal medicine"]
  },
  {
    keywords: ["child", "baby", "infant", "pediatric", "fever in child"],
    specializationHints: ["pedia", "child", "paediatric"]
  },
  {
    keywords: ["skin", "rash", "allergy", "derma", "itching"],
    specializationHints: ["derma", "skin"]
  }
];

const scoreSpecializationMatch = (doctor, problemDescription = "") => {
  const specialization = normalizeText(doctor?.specialization);
  const problem = normalizeText(problemDescription);
  if (!problem) {
    return specialization ? 1 : 0;
  }

  if (specialization && problem.includes(specialization)) {
    return 4;
  }

  let score = 0;
  PROBLEM_TO_SPECIALIZATION_RULES.forEach((rule) => {
    const keywordMatched = rule.keywords.some((keyword) => problem.includes(keyword));
    if (!keywordMatched) return;
    if (rule.specializationHints.some((hint) => specialization.includes(hint))) {
      score = Math.max(score, 3);
    } else {
      score = Math.max(score, 1);
    }
  });

  if (!score && specialization.includes("general")) {
    score = 2;
  }

  return score;
};

const rankDoctors = async (doctors = [], problemDescription = "") => {
  if (!doctors.length) return [];

  const doctorIds = doctors.map((doctor) => doctor._id);
  const now = Date.now();
  const busyWindowStart = new Date(now - DOCTOR_BUSY_WINDOW_BEFORE_MS);
  const busyWindowEnd = new Date(now + DOCTOR_BUSY_WINDOW_AFTER_MS);
  const loadWindowEnd = new Date(now + DOCTOR_LOAD_WINDOW_MS);

  const appointments = await Appointment.find({
    doctor: { $in: doctorIds },
    status: { $in: ACTIVE_DOCTOR_APPOINTMENT_STATUSES },
    appointmentDate: { $gte: busyWindowStart, $lte: loadWindowEnd }
  }).select("doctor appointmentDate");

  const doctorUsage = new Map();
  appointments.forEach((item) => {
    const doctorId = String(item.doctor);
    const existing = doctorUsage.get(doctorId) || { busyCount: 0, upcomingCount: 0 };
    const appointmentTime = new Date(item.appointmentDate).getTime();
    if (Number.isFinite(appointmentTime)) {
      if (appointmentTime <= busyWindowEnd.getTime()) {
        existing.busyCount += 1;
      }
      existing.upcomingCount += 1;
    }
    doctorUsage.set(doctorId, existing);
  });

  return doctors
    .map((doctor) => {
      const usage = doctorUsage.get(String(doctor._id)) || { busyCount: 0, upcomingCount: 0 };
      return {
        doctor,
        specializationScore: scoreSpecializationMatch(doctor, problemDescription),
        isFree: usage.busyCount === 0,
        busyCount: usage.busyCount,
        upcomingCount: usage.upcomingCount
      };
    })
    .sort((a, b) => {
      if (a.specializationScore !== b.specializationScore) {
        return b.specializationScore - a.specializationScore;
      }
      if (a.isFree !== b.isFree) {
        return a.isFree ? -1 : 1;
      }
      if (a.busyCount !== b.busyCount) {
        return a.busyCount - b.busyCount;
      }
      if (a.upcomingCount !== b.upcomingCount) {
        return a.upcomingCount - b.upcomingCount;
      }
      return String(a.doctor.name || "").localeCompare(String(b.doctor.name || ""));
    });
};

const buildHospitalCandidatesFromFleet = (fleetUnits = [], pickupCoordinates) => {
  const grouped = new Map();

  fleetUnits.forEach((unit) => {
    const hospitalName = String(unit.hospitalName || "").trim();
    if (!hospitalName) return;

    const hospitalCoordinates =
      normalizeCoordinates(unit.hospitalCoordinates) ||
      normalizeCoordinates(unit.currentCoordinates);
    const key = `${hospitalName.toLowerCase()}|${Number(hospitalCoordinates?.lat || 0).toFixed(
      6
    )}|${Number(hospitalCoordinates?.lng || 0).toFixed(6)}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        hospitalName,
        hospitalAddress: String(unit.hospitalAddress || "").trim(),
        hospitalCoordinates,
        units: []
      });
    }
    grouped.get(key).units.push(unit);
  });

  return [...grouped.values()]
    .map((candidate) => ({
      ...candidate,
      distanceMeters: haversineDistanceMeters(
        pickupCoordinates,
        normalizeCoordinates(candidate.hospitalCoordinates)
      )
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};

const reserveAmbulanceUnit = async (hospital, pickupCoordinates, updatedByAdminId) => {
  const candidates = [...(hospital.units || [])].sort((a, b) => {
    const aCoords = normalizeCoordinates(a.currentCoordinates) || normalizeCoordinates(a.hospitalCoordinates);
    const bCoords = normalizeCoordinates(b.currentCoordinates) || normalizeCoordinates(b.hospitalCoordinates);
    const aDistance = haversineDistanceMeters(pickupCoordinates, aCoords);
    const bDistance = haversineDistanceMeters(pickupCoordinates, bCoords);
    return aDistance - bDistance;
  });

  for (const unit of candidates) {
    const reserved = await AmbulanceFleet.findOneAndUpdate(
      { _id: unit._id, status: "available" },
      {
        $set: {
          status: "dispatched",
          lastAssignedAt: new Date(),
          updatedByAdmin: updatedByAdminId || unit.updatedByAdmin || unit.createdByAdmin
        }
      },
      { new: true }
    );
    if (reserved) return reserved;
  }

  return null;
};

const releaseAmbulanceUnit = async (unitId, hospitalCoordinates, updatedByAdminId) => {
  if (!unitId) return null;
  const coords = normalizeCoordinates(hospitalCoordinates);
  const updatePayload = {
    status: "available",
    updatedByAdmin: updatedByAdminId
  };
  if (coords) {
    updatePayload.currentCoordinates = coords;
  }
  return AmbulanceFleet.findByIdAndUpdate(unitId, { $set: updatePayload }, { new: true });
};

const buildEtaMinutes = (fromCoords, toCoords) => {
  if (!fromCoords || !toCoords) return 15;
  const distanceKm = haversineDistanceMeters(fromCoords, toCoords) / 1000;
  if (!Number.isFinite(distanceKm)) return 15;
  return Math.max(8, Math.round(distanceKm * 3 + 6));
};

router.post(
  "/book",
  protect,
  authorize("patient", "admin", "super-admin"),
  [
    body("pickupLocation").trim().notEmpty().withMessage("Pickup location is required"),
    body("problemDescription").optional().isString().withMessage("problemDescription must be a string"),
    body("hospitalLocation").optional().isString(),
    body("pickupCoordinates").optional().isObject().withMessage("pickupCoordinates must be an object"),
    body("pickupCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("pickupCoordinates.lng").optional().isFloat({ min: -180, max: 180 }),
    body("hospitalCoordinates").optional().isObject().withMessage("hospitalCoordinates must be an object"),
    body("hospitalCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("hospitalCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const pickupLocation = String(req.body.pickupLocation || "").trim();
    const fallbackHospitalLocation = String(req.body.hospitalLocation || "").trim();
    const problemDescription = String(req.body.problemDescription || "").trim();
    const pickupCoords = normalizeCoordinates(req.body.pickupCoordinates);
    const fallbackHospitalCoords = normalizeCoordinates(req.body.hospitalCoordinates);

    let assignedHospital = null;
    let assignedDoctor = null;
    let assignedDoctorAvailability = "unassigned";
    let assignedAmbulanceUnit = null;

    if (pickupCoords) {
      const fleetUnits = await AmbulanceFleet.find({ status: "available" }).sort({ updatedAt: 1 });
      const nearestHospitals = buildHospitalCandidatesFromFleet(fleetUnits, pickupCoords);

      for (const hospital of nearestHospitals) {
        const hospitalRegex = new RegExp(`^${escapeRegex(hospital.hospitalName)}$`, "i");
        const doctors = await User.find({
          role: "doctor",
          isActive: true,
          hospitalName: hospitalRegex
        }).select("name email specialization phone hospitalName");

        if (!doctors.length) {
          continue;
        }

        const rankedDoctors = await rankDoctors(doctors, problemDescription);
        if (!rankedDoctors.length) {
          continue;
        }

        const reservedAmbulance = await reserveAmbulanceUnit(hospital, pickupCoords, req.user._id);
        if (!reservedAmbulance) {
          continue;
        }

        assignedHospital = hospital;
        assignedDoctor = rankedDoctors[0].doctor;
        assignedDoctorAvailability = rankedDoctors[0].isFree ? "free" : "busy";
        assignedAmbulanceUnit = reservedAmbulance;
        break;
      }
    }

    if (!assignedHospital && !fallbackHospitalLocation) {
      return res.status(409).json({
        success: false,
        message:
          "No nearest hospital with available ambulance found. Ask reception/admin to add available ambulances."
      });
    }

    const hospitalCoordinates =
      normalizeCoordinates(assignedHospital?.hospitalCoordinates) || fallbackHospitalCoords;
    const hospitalLocation =
      String(assignedHospital?.hospitalAddress || "").trim() ||
      String(assignedHospital?.hospitalName || "").trim() ||
      fallbackHospitalLocation;
    const hospitalName = String(assignedHospital?.hospitalName || "").trim() || hospitalLocation;
    const ambulanceCoordinates =
      normalizeCoordinates(assignedAmbulanceUnit?.currentCoordinates) ||
      normalizeCoordinates(assignedAmbulanceUnit?.hospitalCoordinates) ||
      hospitalCoordinates;

    const etaMinutes = assignedAmbulanceUnit
      ? buildEtaMinutes(ambulanceCoordinates, pickupCoords || hospitalCoordinates)
      : undefined;

    let booking;
    try {
      booking = await Ambulance.create({
        requestedBy: req.user._id,
        pickupLocation,
        problemDescription,
        pickupCoordinates: pickupCoords,
        hospitalLocation,
        hospitalName,
        hospitalCoordinates,
        assignedDoctor: assignedDoctor?._id,
        assignedDoctorName: assignedDoctor?.name,
        assignedDoctorSpecialization: assignedDoctor?.specialization,
        doctorAvailabilityStatus: assignedDoctor ? assignedDoctorAvailability : "unassigned",
        assignedAmbulance: assignedAmbulanceUnit?._id,
        assignedAmbulanceVehicleNumber: assignedAmbulanceUnit?.vehicleNumber,
        driverName: assignedAmbulanceUnit?.driverName,
        vehicleNumber: assignedAmbulanceUnit?.vehicleNumber,
        etaMinutes,
        ambulanceCoordinates,
        lastLocationUpdatedAt: ambulanceCoordinates ? new Date() : undefined
      });
    } catch (error) {
      if (assignedAmbulanceUnit?._id) {
        await releaseAmbulanceUnit(assignedAmbulanceUnit._id, hospitalCoordinates, req.user._id);
      }
      throw error;
    }

    const populated = await Ambulance.findById(booking._id)
      .populate("requestedBy", "name email phone")
      .populate("assignedDoctor", "name email specialization phone hospitalName")
      .populate("assignedAmbulance", "vehicleNumber driverName driverPhone status");

    return res.status(201).json({
      success: true,
      message: assignedAmbulanceUnit
        ? "Ambulance booked and auto-assigned to nearest hospital"
        : "Ambulance booking created",
      booking: populated
    });
  })
);

router.get(
  "/fleet",
  protect,
  authorize("admin", "super-admin"),
  [
    query("status")
      .optional()
      .isIn(["available", "dispatched", "maintenance", "inactive"])
      .withMessage("Invalid fleet status filter")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.user.role !== "super-admin") {
      const hospitalRegex = requesterHospitalRegex(req.user);
      if (hospitalRegex) {
        filter.hospitalName = hospitalRegex;
      }
    } else if (req.query.hospitalName) {
      filter.hospitalName = new RegExp(`^${escapeRegex(String(req.query.hospitalName).trim())}$`, "i");
    }

    const fleet = await AmbulanceFleet.find(filter)
      .populate("createdByAdmin", "name email accessLevel hospitalName")
      .populate("updatedByAdmin", "name email accessLevel")
      .sort({ status: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      canManageFleet: canManageAmbulanceFleet(req.user),
      fleet
    });
  })
);

router.post(
  "/fleet",
  protect,
  authorize("admin", "super-admin"),
  [
    body("vehicleNumber").trim().notEmpty().withMessage("Vehicle number is required"),
    body("driverName").optional().isString(),
    body("driverPhone").optional().isString(),
    body("notes").optional().isString(),
    body("status")
      .optional()
      .isIn(["available", "dispatched", "maintenance", "inactive"])
      .withMessage("Invalid fleet status"),
    body("hospitalName").optional().isString(),
    body("hospitalAddress").optional().isString(),
    body("hospitalCoordinates").optional().isObject().withMessage("hospitalCoordinates must be an object"),
    body("hospitalCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("hospitalCoordinates.lng").optional().isFloat({ min: -180, max: 180 }),
    body("currentCoordinates").optional().isObject().withMessage("currentCoordinates must be an object"),
    body("currentCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("currentCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!canManageAmbulanceFleet(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only operations/full admin can add ambulance inventory"
      });
    }

    const fallbackHospitalName = String(req.user.hospitalName || "").trim();
    const fallbackHospitalAddress = String(req.user.hospitalAddress || "").trim();
    const fallbackHospitalCoordinates = normalizeCoordinates(req.user.hospitalCoordinates);
    const hospitalName =
      req.user.role === "super-admin"
        ? String(req.body.hospitalName || fallbackHospitalName).trim()
        : fallbackHospitalName || String(req.body.hospitalName || "").trim();

    if (!hospitalName) {
      return res.status(400).json({
        success: false,
        message: "Hospital name is required for ambulance inventory"
      });
    }

    const hospitalAddress =
      req.user.role === "super-admin"
        ? String(req.body.hospitalAddress || fallbackHospitalAddress).trim()
        : fallbackHospitalAddress || String(req.body.hospitalAddress || "").trim();
    const hospitalCoordinates =
      normalizeCoordinates(req.body.hospitalCoordinates) || fallbackHospitalCoordinates;
    const currentCoordinates =
      normalizeCoordinates(req.body.currentCoordinates) || hospitalCoordinates;
    const normalizedVehicleNumber = String(req.body.vehicleNumber || "").trim().toUpperCase();

    const existingVehicle = await AmbulanceFleet.findOne({
      vehicleNumber: normalizedVehicleNumber
    }).select("_id");
    if (existingVehicle) {
      return res.status(409).json({
        success: false,
        message: "Ambulance with this vehicle number already exists"
      });
    }

    const ambulance = await AmbulanceFleet.create({
      hospitalName,
      hospitalAddress,
      hospitalCoordinates,
      vehicleNumber: normalizedVehicleNumber,
      driverName: String(req.body.driverName || "").trim(),
      driverPhone: String(req.body.driverPhone || "").trim(),
      status: req.body.status || "available",
      currentCoordinates,
      notes: String(req.body.notes || "").trim(),
      createdByAdmin: req.user._id,
      updatedByAdmin: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Ambulance inventory added",
      ambulance
    });
  })
);

router.patch(
  "/fleet/:fleetId",
  protect,
  authorize("admin", "super-admin"),
  [
    param("fleetId").isMongoId().withMessage("Valid fleet id is required"),
    body("driverName").optional().isString(),
    body("driverPhone").optional().isString(),
    body("notes").optional().isString(),
    body("status")
      .optional()
      .isIn(["available", "dispatched", "maintenance", "inactive"])
      .withMessage("Invalid fleet status"),
    body("currentCoordinates").optional().isObject().withMessage("currentCoordinates must be an object"),
    body("currentCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("currentCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!canManageAmbulanceFleet(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only operations/full admin can update ambulance inventory"
      });
    }

    const ambulance = await AmbulanceFleet.findById(req.params.fleetId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: "Ambulance inventory not found" });
    }

    if (req.user.role !== "super-admin") {
      const hospitalRegex = requesterHospitalRegex(req.user);
      if (hospitalRegex && !hospitalRegex.test(String(ambulance.hospitalName || ""))) {
        return res.status(403).json({
          success: false,
          message: "Access denied for this hospital ambulance inventory"
        });
      }
    }

    if (req.body.driverName !== undefined) {
      ambulance.driverName = String(req.body.driverName || "").trim();
    }
    if (req.body.driverPhone !== undefined) {
      ambulance.driverPhone = String(req.body.driverPhone || "").trim();
    }
    if (req.body.notes !== undefined) {
      ambulance.notes = String(req.body.notes || "").trim();
    }
    if (req.body.status !== undefined) {
      ambulance.status = req.body.status;
    }
    const coords = normalizeCoordinates(req.body.currentCoordinates);
    if (coords) {
      ambulance.currentCoordinates = coords;
    }

    ambulance.updatedByAdmin = req.user._id;
    await ambulance.save();

    return res.status(200).json({
      success: true,
      message: "Ambulance inventory updated",
      ambulance
    });
  })
);

router.get(
  "/my",
  protect,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === "patient") {
      filter.requestedBy = req.user._id;
    } else if (req.user.role === "admin") {
      const hospitalRegex = requesterHospitalRegex(req.user);
      if (hospitalRegex) {
        filter.$or = [{ hospitalName: hospitalRegex }, { hospitalLocation: hospitalRegex }];
      }
    } else if (req.user.role === "doctor") {
      filter.assignedDoctor = req.user._id;
    }

    const bookings = await Ambulance.find(filter)
      .populate("requestedBy", "name email phone")
      .populate("assignedDoctor", "name email specialization phone hospitalName")
      .populate("assignedAmbulance", "vehicleNumber driverName driverPhone status")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, bookings });
  })
);

router.patch(
  "/:id/status",
  protect,
  authorize("doctor", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid booking id is required"),
    body("status")
      .isIn(["requested", "dispatched", "arrived", "completed", "cancelled"])
      .withMessage("Invalid ambulance status"),
    body("driverName").optional().isString().withMessage("driverName must be a string"),
    body("vehicleNumber").optional().isString().withMessage("vehicleNumber must be a string"),
    body("etaMinutes").optional().isInt({ min: 0 }).withMessage("etaMinutes must be >= 0"),
    body("ambulanceCoordinates").optional().isObject().withMessage("ambulanceCoordinates must be an object"),
    body("ambulanceCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("ambulanceCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const booking = await Ambulance.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Ambulance booking not found" });
    }

    if (!hasBookingAccess(req.user, booking)) {
      return res.status(403).json({ success: false, message: "Access denied for this booking" });
    }

    const { status, driverName, vehicleNumber, etaMinutes, ambulanceCoordinates } = req.body;
    booking.status = status;
    if (driverName !== undefined) booking.driverName = String(driverName || "").trim();
    if (vehicleNumber !== undefined) {
      booking.vehicleNumber = String(vehicleNumber || "").trim().toUpperCase();
      booking.assignedAmbulanceVehicleNumber = booking.vehicleNumber;
    }
    if (etaMinutes !== undefined) booking.etaMinutes = Number(etaMinutes);
    const coords = normalizeCoordinates(ambulanceCoordinates);
    if (coords) {
      booking.ambulanceCoordinates = coords;
      booking.lastLocationUpdatedAt = new Date();
    }

    await booking.save();

    if (booking.assignedAmbulance) {
      if (status === "completed" || status === "cancelled") {
        await releaseAmbulanceUnit(
          booking.assignedAmbulance,
          booking.hospitalCoordinates,
          req.user._id
        );
      } else {
        const fleetUpdate = {
          status: "dispatched",
          updatedByAdmin: req.user._id
        };
        if (coords) {
          fleetUpdate.currentCoordinates = coords;
        }
        if (driverName !== undefined) {
          fleetUpdate.driverName = String(driverName || "").trim();
        }
        if (vehicleNumber !== undefined) {
          fleetUpdate.vehicleNumber = String(vehicleNumber || "").trim().toUpperCase();
        }
        await AmbulanceFleet.findByIdAndUpdate(
          booking.assignedAmbulance,
          { $set: fleetUpdate },
          { new: true }
        );
      }
    }

    const populated = await Ambulance.findById(booking._id)
      .populate("requestedBy", "name email phone")
      .populate("assignedDoctor", "name email specialization phone hospitalName")
      .populate("assignedAmbulance", "vehicleNumber driverName driverPhone status");

    return res.status(200).json({
      success: true,
      message: "Ambulance booking updated",
      booking: populated
    });
  })
);

router.get(
  "/:id",
  protect,
  [param("id").isMongoId().withMessage("Valid booking id is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const booking = await Ambulance.findById(req.params.id)
      .populate("requestedBy", "name email phone")
      .populate("assignedDoctor", "name email specialization phone hospitalName")
      .populate("assignedAmbulance", "vehicleNumber driverName driverPhone status");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Ambulance booking not found" });
    }

    if (!hasBookingAccess(req.user, booking)) {
      return res.status(403).json({ success: false, message: "Access denied for this booking" });
    }

    return res.status(200).json({ success: true, booking });
  })
);

router.patch(
  "/:id/location",
  protect,
  authorize("doctor", "admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid booking id is required"),
    body("lat").isFloat({ min: -90, max: 90 }).withMessage("lat must be valid"),
    body("lng").isFloat({ min: -180, max: 180 }).withMessage("lng must be valid"),
    body("etaMinutes").optional().isInt({ min: 0 }).withMessage("etaMinutes must be >= 0")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const booking = await Ambulance.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Ambulance booking not found" });
    }

    if (!hasBookingAccess(req.user, booking)) {
      return res.status(403).json({ success: false, message: "Access denied for this booking" });
    }

    const nextCoordinates = {
      lat: Number(req.body.lat),
      lng: Number(req.body.lng)
    };
    booking.ambulanceCoordinates = nextCoordinates;
    booking.lastLocationUpdatedAt = new Date();
    if (req.body.etaMinutes !== undefined) {
      booking.etaMinutes = Number(req.body.etaMinutes);
    }

    await booking.save();

    if (booking.assignedAmbulance) {
      await AmbulanceFleet.findByIdAndUpdate(
        booking.assignedAmbulance,
        {
          $set: {
            currentCoordinates: nextCoordinates,
            updatedByAdmin: req.user._id
          }
        },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Ambulance live location updated",
      booking
    });
  })
);

module.exports = router;
