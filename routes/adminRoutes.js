const fs = require("fs");
const path = require("path");
const express = require("express");
const AdmZip = require("adm-zip");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Emergency = require("../models/Emergency");
const Ambulance = require("../models/Ambulance");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Insurance = require("../models/Insurance");
const SystemSettings = require("../models/SystemSettings");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();
const normalizeCoordinates = (coords) => {
  if (!coords || typeof coords !== "object") return undefined;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
};
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const doctorScopeFilterForRequester = (user) => {
  if (user?.role === "super-admin") {
    return { role: "doctor" };
  }

  const hospitalName = String(user?.hospitalName || "").trim();
  if (hospitalName) {
    return {
      role: "doctor",
      hospitalName: new RegExp(`^${escapeRegex(hospitalName)}$`, "i")
    };
  }

  return {
    role: "doctor",
    createdByAdmin: user?._id
  };
};

const doctorIdsForRequester = async (user) => {
  if (user?.role === "super-admin") return null;
  const doctorFilter = doctorScopeFilterForRequester(user);
  return User.find(doctorFilter).distinct("_id");
};

router.post(
  "/admins",
  protect,
  authorize("admin", "super-admin"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("hospitalName").trim().notEmpty().withMessage("Hospital name is required"),
    body("hospitalAddress").optional().isString(),
    body("hospitalCoordinates").optional().isObject().withMessage("hospitalCoordinates must be an object"),
    body("hospitalCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("hospitalCoordinates.lng").optional().isFloat({ min: -180, max: 180 }),
    body("phone").optional().isString(),
    body("department").optional().isString(),
    body("accessLevel")
      .optional()
      .isIn(["full", "operations", "limited", "receptionist"])
      .withMessage("accessLevel must be full, operations, limited, or receptionist")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      password,
      hospitalName,
      hospitalAddress,
      hospitalCoordinates,
      phone,
      department,
      accessLevel = "limited"
    } = req.body;
    const normalizedCoordinates = normalizeCoordinates(hospitalCoordinates);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const admin = await User.create({
      name,
      email,
      password,
      hospitalName,
      hospitalAddress,
      hospitalCoordinates: normalizedCoordinates,
      phone,
      department,
      accessLevel,
      role: "admin",
      createdByAdmin: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        hospitalName: admin.hospitalName,
        hospitalAddress: admin.hospitalAddress,
        hospitalCoordinates: admin.hospitalCoordinates,
        department: admin.department,
        accessLevel: admin.accessLevel,
        isActive: admin.isActive,
        createdByAdmin: admin.createdByAdmin,
        createdAt: admin.createdAt
      }
    });
  })
);

router.post(
  "/admins/pair",
  protect,
  authorize("super-admin"),
  [
    body("baseName").trim().notEmpty().withMessage("Base admin name is required"),
    body("hospitalName").trim().notEmpty().withMessage("Hospital name is required"),
    body("hospitalAddress").trim().notEmpty().withMessage("Hospital address is required"),
    body("hospitalCoordinates").isObject().withMessage("Hospital map coordinates are required"),
    body("hospitalCoordinates.lat").isFloat({ min: -90, max: 90 }),
    body("hospitalCoordinates.lng").isFloat({ min: -180, max: 180 }),
    body("phone").optional().isString(),
    body("operational").isObject().withMessage("Operational account details are required"),
    body("operational.email")
      .isEmail()
      .withMessage("Operational email must be valid")
      .normalizeEmail(),
    body("operational.password")
      .isLength({ min: 6 })
      .withMessage("Operational password must be at least 6 characters"),
    body("receptionist").isObject().withMessage("Receptionist account details are required"),
    body("receptionist.email")
      .isEmail()
      .withMessage("Receptionist email must be valid")
      .normalizeEmail(),
    body("receptionist.password")
      .isLength({ min: 6 })
      .withMessage("Receptionist password must be at least 6 characters")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      baseName,
      hospitalName,
      hospitalAddress,
      hospitalCoordinates,
      phone,
      operational,
      receptionist
    } = req.body;
    const normalizedCoordinates = normalizeCoordinates(hospitalCoordinates);
    const operationalEmail = String(operational.email || "").trim().toLowerCase();
    const receptionistEmail = String(receptionist.email || "").trim().toLowerCase();

    if (operationalEmail === receptionistEmail) {
      return res.status(400).json({
        success: false,
        message: "Operational and receptionist email must be different"
      });
    }

    const existingUsers = await User.find({
      email: { $in: [operationalEmail, receptionistEmail] }
    }).select("email");

    if (existingUsers.length) {
      const existingEmails = existingUsers.map((user) => user.email).join(", ");
      return res.status(409).json({
        success: false,
        message: `User already exists for email: ${existingEmails}`
      });
    }

    const sharedPayload = {
      hospitalName,
      hospitalAddress,
      hospitalCoordinates: normalizedCoordinates,
      phone: String(phone || "").trim(),
      role: "admin",
      createdByAdmin: req.user._id
    };

    const [operationsAdmin, receptionistAdmin] = await User.create([
      {
        name: `${baseName} Operations`,
        email: operationalEmail,
        password: operational.password,
        department: "Operations",
        accessLevel: "operations",
        ...sharedPayload
      },
      {
        name: `${baseName} Receptionist`,
        email: receptionistEmail,
        password: receptionist.password,
        department: "Reception",
        accessLevel: "receptionist",
        ...sharedPayload
      }
    ]);

    const mapAdminResponse = (admin) => ({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      hospitalName: admin.hospitalName,
      hospitalAddress: admin.hospitalAddress,
      hospitalCoordinates: admin.hospitalCoordinates,
      department: admin.department,
      accessLevel: admin.accessLevel,
      isActive: admin.isActive,
      createdByAdmin: admin.createdByAdmin,
      createdAt: admin.createdAt
    });

    return res.status(201).json({
      success: true,
      message: "Operations and receptionist admin IDs created successfully",
      admins: [mapAdminResponse(operationsAdmin), mapAdminResponse(receptionistAdmin)]
    });
  })
);

router.patch(
  "/admins/:id/password",
  protect,
  authorize("super-admin"),
  [
    param("id").isMongoId().withMessage("Valid admin id is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const admin = await User.findOne({
      _id: req.params.id,
      role: "admin"
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }

    admin.password = String(req.body.password || "");
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Admin password updated successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        accessLevel: admin.accessLevel,
        hospitalName: admin.hospitalName
      }
    });
  })
);

router.patch(
  "/hospitals",
  protect,
  authorize("super-admin"),
  [
    body("currentHospitalName").trim().notEmpty().withMessage("Current hospital name is required"),
    body("hospitalName").optional().trim().notEmpty().withMessage("hospitalName cannot be empty"),
    body("hospitalAddress").optional().isString(),
    body("hospitalCoordinates").optional().isObject().withMessage("hospitalCoordinates must be an object"),
    body("hospitalCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("hospitalCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const currentHospitalName = String(req.body.currentHospitalName || "").trim();
    const nextHospitalName = req.body.hospitalName !== undefined
      ? String(req.body.hospitalName || "").trim()
      : undefined;
    const nextHospitalAddress = req.body.hospitalAddress !== undefined
      ? String(req.body.hospitalAddress || "").trim()
      : undefined;
    const nextHospitalCoordinates = req.body.hospitalCoordinates !== undefined
      ? normalizeCoordinates(req.body.hospitalCoordinates)
      : undefined;

    if (req.body.hospitalCoordinates !== undefined && !nextHospitalCoordinates) {
      return res.status(400).json({
        success: false,
        message: "Valid hospitalCoordinates with lat and lng are required"
      });
    }

    if (
      nextHospitalName === undefined &&
      nextHospitalAddress === undefined &&
      nextHospitalCoordinates === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one hospital field to update"
      });
    }

    const currentHospitalRegex = new RegExp(`^${escapeRegex(currentHospitalName)}$`, "i");
    const hospitalAdmins = await User.find({
      role: "admin",
      hospitalName: currentHospitalRegex
    }).select("_id hospitalName");

    if (!hospitalAdmins.length) {
      return res.status(404).json({
        success: false,
        message: `Hospital "${currentHospitalName}" not found`
      });
    }

    const adminIds = hospitalAdmins.map((admin) => admin._id);
    const currentCanonical = String(hospitalAdmins[0].hospitalName || currentHospitalName).trim();
    const targetHospitalName = nextHospitalName || currentCanonical;

    if (
      nextHospitalName &&
      nextHospitalName.toLowerCase() !== currentCanonical.toLowerCase()
    ) {
      const collisionAdmin = await User.findOne({
        role: "admin",
        hospitalName: new RegExp(`^${escapeRegex(nextHospitalName)}$`, "i"),
        _id: { $nin: adminIds }
      }).select("_id");

      if (collisionAdmin) {
        return res.status(409).json({
          success: false,
          message: `Another hospital already exists with name "${nextHospitalName}"`
        });
      }
    }

    const adminSet = {};
    if (nextHospitalName !== undefined) adminSet.hospitalName = nextHospitalName;
    if (nextHospitalAddress !== undefined) adminSet.hospitalAddress = nextHospitalAddress;
    if (nextHospitalCoordinates !== undefined) adminSet.hospitalCoordinates = nextHospitalCoordinates;

    const updates = [];
    updates.push(User.updateMany({ _id: { $in: adminIds } }, { $set: adminSet }));

    if (nextHospitalName !== undefined || nextHospitalCoordinates !== undefined) {
      const doctorSet = {};
      if (nextHospitalName !== undefined) doctorSet.hospitalName = nextHospitalName;
      if (nextHospitalCoordinates !== undefined) doctorSet.hospitalCoordinates = nextHospitalCoordinates;

      updates.push(
        User.updateMany(
          {
            role: "doctor",
            $or: [{ hospitalName: currentHospitalRegex }, { createdByAdmin: { $in: adminIds } }]
          },
          { $set: doctorSet }
        )
      );
    }

    const bookingSet = {};
    if (nextHospitalName !== undefined) bookingSet.hospitalName = nextHospitalName;
    if (nextHospitalAddress !== undefined) bookingSet.hospitalLocation = nextHospitalAddress;
    if (nextHospitalCoordinates !== undefined) bookingSet.hospitalCoordinates = nextHospitalCoordinates;
    if (Object.keys(bookingSet).length) {
      updates.push(
        Ambulance.updateMany(
          { $or: [{ hospitalName: currentHospitalRegex }, { hospitalLocation: currentHospitalRegex }] },
          { $set: bookingSet }
        )
      );
    }

    const fleetSet = {};
    if (nextHospitalName !== undefined) fleetSet.hospitalName = nextHospitalName;
    if (nextHospitalAddress !== undefined) fleetSet.hospitalAddress = nextHospitalAddress;
    if (nextHospitalCoordinates !== undefined) fleetSet.hospitalCoordinates = nextHospitalCoordinates;
    if (Object.keys(fleetSet).length) {
      updates.push(
        AmbulanceFleet.updateMany(
          { hospitalName: currentHospitalRegex },
          { $set: fleetSet }
        )
      );
    }

    await Promise.all(updates);

    const refreshedAdmins = await User.find({
      role: "admin",
      hospitalName: new RegExp(`^${escapeRegex(targetHospitalName)}$`, "i")
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: `Hospital details updated for "${targetHospitalName}"`,
      hospital: {
        previousName: currentCanonical,
        hospitalName: targetHospitalName,
        hospitalAddress:
          nextHospitalAddress !== undefined
            ? nextHospitalAddress
            : String(refreshedAdmins[0]?.hospitalAddress || "").trim(),
        hospitalCoordinates:
          nextHospitalCoordinates !== undefined
            ? nextHospitalCoordinates
            : refreshedAdmins[0]?.hospitalCoordinates || null
      },
      admins: refreshedAdmins
    });
  })
);

router.delete(
  "/hospitals",
  protect,
  authorize("super-admin"),
  [body("hospitalName").trim().notEmpty().withMessage("Hospital name is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const hospitalName = String(req.body.hospitalName || "").trim();
    const hospitalRegex = new RegExp(`^${escapeRegex(hospitalName)}$`, "i");

    const hospitalAdmins = await User.find({
      role: "admin",
      hospitalName: hospitalRegex
    }).select("_id");

    if (!hospitalAdmins.length) {
      return res.status(404).json({
        success: false,
        message: `Hospital "${hospitalName}" not found`
      });
    }

    const hospitalAdminIds = hospitalAdmins.map((admin) => admin._id);

    const [deletedAdmins, deletedDoctors] = await Promise.all([
      User.deleteMany({ _id: { $in: hospitalAdminIds } }),
      User.deleteMany({
        role: "doctor",
        $or: [{ hospitalName: hospitalRegex }, { createdByAdmin: { $in: hospitalAdminIds } }]
      })
    ]);

    return res.status(200).json({
      success: true,
      message: `Hospital "${hospitalName}" deleted. Removed ${deletedAdmins.deletedCount} admin IDs and ${deletedDoctors.deletedCount} doctor IDs.`,
      deleted: {
        admins: deletedAdmins.deletedCount,
        doctors: deletedDoctors.deletedCount
      }
    });
  })
);

router.get(
  "/admins",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const admins = await User.find({
      role: "admin",
      createdByAdmin: req.user._id
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: admins.length,
      admins
    });
  })
);

router.post(
  "/doctors",
  protect,
  authorize("admin", "super-admin"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("specialization").trim().notEmpty().withMessage("Specialization is required"),
    body("experienceYears").optional(),
    body("experience").optional(),
    body("phone").optional().isString(),
    body("clinicAddress").optional().isString(),
    body("clinicCoordinates").optional().isObject().withMessage("clinicCoordinates must be an object"),
    body("clinicCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("clinicCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, specialization, experienceYears, experience, clinicAddress, clinicCoordinates, hospitalName } =
      req.body;
    const normalizedCoordinates = normalizeCoordinates(clinicCoordinates);
    const expVal = Number(experienceYears !== undefined ? experienceYears : (experience !== undefined ? experience : 0));

    let targetHospitalName = hospitalName || req.user.hospitalName || undefined;
    let targetHospitalAddress = req.user.hospitalAddress || undefined;
    let targetHospitalCoordinates = normalizeCoordinates(req.user.hospitalCoordinates);

    if (hospitalName) {
      const hospitalAdmin = await User.findOne({
        role: "admin",
        hospitalName: new RegExp(`^${escapeRegex(hospitalName)}$`, "i")
      });
      if (hospitalAdmin) {
        targetHospitalName = hospitalAdmin.hospitalName;
        targetHospitalAddress = hospitalAdmin.hospitalAddress || targetHospitalAddress;
        targetHospitalCoordinates = hospitalAdmin.hospitalCoordinates || targetHospitalCoordinates;
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const doctor = await User.create({
      name,
      email,
      password,
      phone,
      specialization,
      experienceYears: expVal,
      experience: expVal,
      rating: 0,
      reviewCount: 0,
      clinicAddress: clinicAddress || targetHospitalAddress || undefined,
      clinicCoordinates: normalizedCoordinates,
      hospitalName: targetHospitalName,
      hospitalAddress: targetHospitalAddress,
      hospitalCoordinates: targetHospitalCoordinates,
      role: "doctor",
      createdByAdmin: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Doctor account created successfully",
      doctor: {
        id: doctor._id,
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
        experienceYears: doctor.experienceYears,
        experience: doctor.experience,
        rating: doctor.rating,
        reviewCount: doctor.reviewCount,
        clinicAddress: doctor.clinicAddress,
        clinicCoordinates: doctor.clinicCoordinates,
        hospitalName: doctor.hospitalName,
        hospitalCoordinates: doctor.hospitalCoordinates,
        role: doctor.role,
        isActive: doctor.isActive,
        createdByAdmin: doctor.createdByAdmin,
        createdAt: doctor.createdAt
      }
    });
  })
);

router.get(
  "/doctors",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const doctors = await User.find(doctorScopeFilterForRequester(req.user))
      .select("-password")
      .sort({ createdAt: -1 });

    const doctorIds = doctors.map((d) => d._id);
    const ratingsAgg = await Appointment.aggregate([
      {
        $match: {
          doctor: { $in: doctorIds },
          doctorRating: { $gte: 1, $lte: 5 }
        }
      },
      {
        $group: {
          _id: "$doctor",
          avgRating: { $avg: "$doctorRating" },
          count: { $sum: 1 }
        }
      }
    ]);

    const ratingMap = new Map();
    ratingsAgg.forEach((item) => {
      ratingMap.set(String(item._id), {
        avgRating: Number(item.avgRating.toFixed(1)),
        count: item.count
      });
    });

    const normalizedDoctors = doctors.map((doc) => {
      const docObj = doc.toObject();
      const rInfo = ratingMap.get(String(doc._id)) || { avgRating: 0, count: 0 };
      const exp = Number(docObj.experienceYears ?? docObj.experience ?? 0);
      docObj.rating = rInfo.avgRating;
      docObj.reviewCount = rInfo.count;
      docObj.experienceYears = exp;
      docObj.experience = exp;
      return docObj;
    });

    return res.status(200).json({
      success: true,
      count: normalizedDoctors.length,
      doctors: normalizedDoctors
    });
  })
);

router.patch(
  "/doctors/:id",
  protect,
  authorize("admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid doctor id is required"),
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("specialization")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Specialization cannot be empty"),
    body("experienceYears").optional(),
    body("experience").optional(),
    body("phone").optional().isString(),
    body("clinicAddress").optional().isString(),
    body("clinicCoordinates").optional().isObject().withMessage("clinicCoordinates must be an object"),
    body("clinicCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("clinicCoordinates.lng").optional().isFloat({ min: -180, max: 180 }),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const doctor = await User.findOne({
      _id: req.params.id,
      ...doctorScopeFilterForRequester(req.user)
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found for this admin" });
    }

    if (req.body.email && req.body.email !== doctor.email) {
      const existingEmail = await User.findOne({
        email: req.body.email,
        _id: { $ne: doctor._id }
      });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
    }

    const fields = ["name", "email", "phone", "specialization", "password", "clinicAddress"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        doctor[field] = req.body[field];
      }
    });

    const expInput = req.body.experienceYears !== undefined ? req.body.experienceYears : req.body.experience;
    if (expInput !== undefined) {
      const expNum = Number(expInput || 0);
      doctor.experienceYears = expNum;
      doctor.experience = expNum;
    }

    if (req.body.clinicCoordinates !== undefined) {
      doctor.clinicCoordinates = normalizeCoordinates(req.body.clinicCoordinates);
    }

    if (req.body.isActive !== undefined) {
      doctor.isActive = req.body.isActive;
    }

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Doctor account updated successfully",
      doctor: {
        id: doctor._id,
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
        experienceYears: Number(doctor.experienceYears ?? doctor.experience ?? 0),
        experience: Number(doctor.experienceYears ?? doctor.experience ?? 0),
        rating: Number(doctor.rating || 0),
        reviewCount: Number(doctor.reviewCount || 0),
        clinicAddress: doctor.clinicAddress,
        clinicCoordinates: doctor.clinicCoordinates,
        hospitalName: doctor.hospitalName,
        hospitalCoordinates: doctor.hospitalCoordinates,
        role: doctor.role,
        isActive: doctor.isActive,
        createdByAdmin: doctor.createdByAdmin,
        createdAt: doctor.createdAt
      }
    });
  })
);

router.get(
  "/dashboard",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const [users, appointments, emergencies, ambulances, claims] = await Promise.all([
      User.countDocuments(),
      Appointment.countDocuments(),
      Emergency.countDocuments(),
      Ambulance.countDocuments(),
      Insurance.countDocuments()
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        users,
        appointments,
        emergencies,
        ambulances,
        insuranceClaims: claims
      }
    });
  })
);

router.get(
  "/doctor-reviews",
  protect,
  authorize("admin", "super-admin"),
  [query("limit").optional().isInt({ min: 1, max: 100 })],
  validateRequest,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 30);
    const filter = {
      doctorRating: { $gte: 1, $lte: 5 }
    };

    if (req.user.role === "admin") {
      const scopedDoctorIds = await doctorIdsForRequester(req.user);
      if (!scopedDoctorIds?.length) {
        return res.status(200).json({ success: true, count: 0, reviews: [] });
      }
      filter.doctor = { $in: scopedDoctorIds };
    }

    const reviews = await Appointment.find(filter)
      .populate("patient", "name email phone")
      .populate("doctor", "name email specialization hospitalName")
      .sort({ ratedAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  })
);

router.get(
  "/users",
  protect,
  authorize("admin", "super-admin"),
  [
    query("role")
      .optional()
      .isIn(["patient", "doctor", "admin", "super-admin"])
      .withMessage("Role filter must be patient, doctor, admin, or super-admin")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
      if (req.query.role === "doctor") {
        Object.assign(filter, doctorScopeFilterForRequester(req.user));
      }
      if (req.query.role === "patient" && req.user.role === "admin") {
        const scopedDoctorIds = await doctorIdsForRequester(req.user);
        if (!scopedDoctorIds?.length) {
          return res.status(200).json({ success: true, users: [] });
        }

        const scopedPatientIds = await Appointment.find({
          doctor: { $in: scopedDoctorIds }
        }).distinct("patient");

        if (!scopedPatientIds.length) {
          return res.status(200).json({ success: true, users: [] });
        }

        filter._id = { $in: scopedPatientIds };
      }
    }

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, users });
  })
);

router.patch(
  "/users/:id/toggle-active",
  protect,
  authorize("admin", "super-admin"),
  [
    param("id").isMongoId().withMessage("Valid user id is required"),
    body("isActive").isBoolean().withMessage("isActive must be boolean")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = req.body.isActive;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User active status updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  })
);

router.get(
  "/live-metrics",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const connectedSockets = req.io ? req.io.engine.clientsCount : 0;
    const videoRoomsMap = typeof req.getVideoRooms === "function" ? req.getVideoRooms() : null;
    const activeVideoRooms = videoRoomsMap ? videoRoomsMap.size : 0;

    const [
      totalPatients,
      totalDoctors,
      totalAdmins,
      pendingAppointments,
      waitingEmergencies,
      inProgressEmergencies,
      availableAmbulances,
      dispatchedAmbulances
    ] = await Promise.all([
      User.countDocuments({ role: "patient" }),
      User.countDocuments({ role: "doctor" }),
      User.countDocuments({ role: "admin" }),
      Appointment.countDocuments({ status: "pending" }),
      Emergency.countDocuments({ status: "waiting" }),
      Emergency.countDocuments({ status: "in_progress" }),
      AmbulanceFleet.countDocuments({ status: "available" }),
      AmbulanceFleet.countDocuments({ status: "dispatched" })
    ]);

    return res.status(200).json({
      success: true,
      server: {
        uptimeSeconds,
        memoryRssMb: (memory.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(2),
        connectedSockets,
        activeVideoRooms
      },
      counts: {
        totalPatients,
        totalDoctors,
        totalAdmins,
        pendingAppointments,
        waitingEmergencies,
        inProgressEmergencies,
        availableAmbulances,
        dispatchedAmbulances
      }
    });
  })
);

router.patch(
  "/users/:id/role",
  protect,
  authorize("super-admin"),
  [
    param("id").isMongoId().withMessage("Valid user id is required"),
    body("role")
      .isIn(["patient", "doctor", "admin", "super-admin"])
      .withMessage("Invalid user role"),
    body("accessLevel")
      .optional()
      .isIn(["full", "operations", "limited", "receptionist"])
      .withMessage("Invalid access level")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.role = req.body.role;
    if (req.body.accessLevel) {
      user.accessLevel = req.body.accessLevel;
    }
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessLevel: user.accessLevel,
        isActive: user.isActive
      }
    });
  })
);

router.post(
  "/broadcast-alert",
  protect,
  authorize("admin", "super-admin"),
  [
    body("title").trim().notEmpty().withMessage("Alert title is required"),
    body("message").trim().notEmpty().withMessage("Alert message is required"),
    body("level")
      .optional()
      .isIn(["info", "warning", "critical"])
      .withMessage("Invalid alert level")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { title, message, level = "info" } = req.body;

    const alertPayload = {
      id: `alert-${Date.now()}`,
      title,
      message,
      level,
      sender: req.user.name,
      senderRole: req.user.role,
      timestamp: new Date().toISOString()
    };

    if (req.io) {
      req.io.emit("system:broadcast-alert", alertPayload);
    }

    return res.status(200).json({
      success: true,
      message: "System alert broadcasted to all connected users",
      alert: alertPayload
    });
  })
);

/**
 * 📁 Storage Management APIs
 */
const STORAGE_ROOT = path.join(__dirname, "..", "storage");

const sanitizeFolderName = (name = "Default_Hospital") => {
  return String(name).trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "General_Hospital";
};

// GET /api/admin/storage/files - List files grouped by hospital folder
router.get(
  "/storage/files",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    if (!fs.existsSync(STORAGE_ROOT)) {
      fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }

    const hospitalFolders = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    let allFiles = [];

    hospitalFolders.forEach(folder => {
      const folderPath = path.join(STORAGE_ROOT, folder);
      const files = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .map(dirent => {
          const filePath = path.join(folderPath, dirent.name);
          const stat = fs.statSync(filePath);
          const ext = path.extname(dirent.name).toLowerCase();

          let fileType = "document";
          if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) fileType = "image";
          if ([".pdf"].includes(ext)) fileType = "pdf";

          return {
            filename: dirent.name,
            hospitalFolder: folder,
            fileType: fileType,
            sizeBytes: stat.size,
            sizeKb: (stat.size / 1024).toFixed(1) + " KB",
            updatedAt: stat.mtime,
            url: `/storage/${folder}/${dirent.name}`
          };
        });
      allFiles = allFiles.concat(files);
    });

    res.json({
      success: true,
      count: allFiles.length,
      hospitalCount: hospitalFolders.length,
      data: allFiles
    });
  })
);

// POST /api/admin/storage/upload - Upload file into storage/<Hospital_Name>/
router.post(
  "/storage/upload",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const { hospitalName = "Arogya_Central_Hospital", folder = "", category = "General" } = req.body;
    const fileName = req.body.filename || req.body.fileName;
    const fileData = req.body.contentBase64 || req.body.fileData;

    if (!fileName || !fileData) {
      return res.status(400).json({ success: false, message: "filename and fileData (base64 or text) are required" });
    }

    const subDir = folder ? String(folder).trim() : sanitizeFolderName(hospitalName);
    const targetFolder = path.join(STORAGE_ROOT, subDir);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const cleanFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetFilePath = path.join(targetFolder, cleanFileName);

    let buffer;
    if (String(fileData).includes(";base64,")) {
      buffer = Buffer.from(String(fileData).split(";base64,")[1], "base64");
    } else {
      buffer = Buffer.from(String(fileData).replace(/^data:.*?;base64,/, ""), "base64");
    }

    fs.writeFileSync(targetFilePath, buffer);

    const stat = fs.statSync(targetFilePath);
    const relativePath = path.relative(STORAGE_ROOT, targetFilePath).replace(/\\/g, "/");

    res.status(201).json({
      success: true,
      message: `File saved cleanly into storage/${relativePath}`,
      file: {
        name: cleanFileName,
        filename: cleanFileName,
        relativePath,
        hospitalFolder: subDir,
        sizeBytes: stat.size,
        formattedSize: `${(stat.size / 1024).toFixed(1)} KB`,
        url: `/storage/${relativePath}`
      }
    });
  })
);

// DELETE /api/admin/storage/files/:folder/:filename - Delete file from hospital folder
router.delete(
  "/storage/files/:folder/:filename",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const { folder, filename } = req.params;
    const targetPath = path.join(STORAGE_ROOT, sanitizeFolderName(folder), String(filename).replace(/[^a-zA-Z0-9._-]/g, "_"));

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return res.json({ success: true, message: `File ${filename} deleted from storage/${folder}` });
    }

    res.status(404).json({ success: false, message: "File not found" });
  })
);

/**
 * 👨‍⚕️ Doctor Termination & Status APIs
 */
router.patch(
  "/doctors/:id/terminate",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    const doctor = await User.findById(req.params.id);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    doctor.isTerminated = true;
    doctor.isActive = false;
    doctor.isAvailable = false;
    await doctor.save();

    res.json({
      success: true,
      message: `Doctor ${doctor.name} has been terminated and deactivated`,
      doctor
    });
  })
);

router.post(
  "/doctors/:id/rate",
  protect,
  asyncHandler(async (req, res) => {
    const { rating } = req.body;
    const numRating = parseFloat(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1.0 and 5.0" });
    }

    const doctor = await User.findById(req.params.id);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const currentTotal = (doctor.rating || 4.8) * (doctor.reviewCount || 12);
    const newCount = (doctor.reviewCount || 12) + 1;
    const newRating = parseFloat(((currentTotal + numRating) / newCount).toFixed(1));

    doctor.rating = newRating;
    doctor.reviewCount = newCount;
    await doctor.save();

    res.json({
      success: true,
      message: "Doctor rating submitted",
      rating: doctor.rating,
      reviewCount: doctor.reviewCount
    });
  })
);

// =========================================================================
// STORAGE MANAGEMENT ROUTES (Google Drive backend for Super Admin & Admin)
// =========================================================================
const STORAGE_BASE_DIR = path.join(__dirname, "..", "storage");

const ensureStorageBaseDir = () => {
  if (!fs.existsSync(STORAGE_BASE_DIR)) {
    fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
  }
};

const resolveSafeStoragePath = (requestedRelativePath = "") => {
  ensureStorageBaseDir();
  const normalized = path.normalize(requestedRelativePath).replace(/^(\.\.[\/\\])+/, "");
  const targetPath = path.join(STORAGE_BASE_DIR, normalized);
  if (!targetPath.startsWith(STORAGE_BASE_DIR)) {
    return STORAGE_BASE_DIR;
  }
  return targetPath;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getFileCategory = (ext = "", isFolder = false) => {
  if (isFolder) return "folder";
  const e = ext.toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".tiff", ".ico"].includes(e)) return "photo";
  if ([".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".csv", ".xls", ".xlsx", ".ppt", ".pptx", ".md"].includes(e)) return "document";
  if ([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"].includes(e)) return "audio";
  if ([".mp4", ".webm", ".avi", ".mkv", ".mov", ".flv"].includes(e)) return "video";
  if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(e)) return "archive";
  if ([".js", ".json", ".html", ".css", ".py", ".java", ".cpp", ".c", ".h"].includes(e)) return "code";
  return "other";
};

router.get(
  "/storage",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    ensureStorageBaseDir();
    let subFolder = String(req.query.folder || "").trim();

    if (req.user.role === "admin") {
      const hospitalRoot = sanitizeFolderName(req.user.hospitalName || "General_Hospital");
      if (!subFolder || (!subFolder.startsWith(hospitalRoot) && !subFolder.startsWith(hospitalRoot + "/"))) {
        subFolder = hospitalRoot;
      }
    }

    const targetDir = resolveSafeStoragePath(subFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (!fs.statSync(targetDir).isDirectory()) {
      return res.status(404).json({ success: false, message: "Storage directory not found" });
    }

    let currentRelative = path.relative(STORAGE_BASE_DIR, targetDir).replace(/\\/g, "/");
    let parentRelative = currentRelative ? path.dirname(currentRelative).replace(/\\/g, "/") : "";

    if (req.user.role === "admin") {
      const hospitalRoot = sanitizeFolderName(req.user.hospitalName || "General_Hospital");
      if (currentRelative.toLowerCase() === hospitalRoot.toLowerCase() || parentRelative === "." || !parentRelative.startsWith(hospitalRoot)) {
        parentRelative = "";
      }
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    let photoCount = 0;
    let documentCount = 0;
    let folderCount = 0;
    let totalSizeBytes = 0;

    const items = entries.map((entry) => {
      const fullPath = path.join(targetDir, entry.name);
      const itemRelativePath = path.relative(STORAGE_BASE_DIR, fullPath).replace(/\\/g, "/");
      const isFolder = entry.isDirectory();
      let sizeBytes = 0;
      let modifiedAt = new Date().toISOString();

      try {
        const stats = fs.statSync(fullPath);
        sizeBytes = isFolder ? 0 : stats.size;
        modifiedAt = stats.mtime.toISOString();
      } catch {
        // file stat fallback
      }

      const ext = isFolder ? "" : path.extname(entry.name);
      const category = getFileCategory(ext, isFolder);

      if (category === "photo") photoCount += 1;
      else if (category === "document") documentCount += 1;
      else if (isFolder) folderCount += 1;

      totalSizeBytes += sizeBytes;

      return {
        name: entry.name,
        relativePath: itemRelativePath,
        isFolder,
        sizeBytes,
        formattedSize: isFolder ? "-" : formatBytes(sizeBytes),
        category,
        extension: ext,
        modifiedAt,
        url: isFolder ? "" : `/storage/${itemRelativePath}`
      };
    });

    items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      success: true,
      currentFolder: currentRelative,
      parentFolder: parentRelative === "." ? "" : parentRelative,
      items,
      stats: {
        totalItems: items.length,
        totalSizeBytes,
        formattedTotalSize: formatBytes(totalSizeBytes),
        photoCount,
        documentCount,
        folderCount
      }
    });
  })
);

router.post(
  "/storage/folder",
  protect,
  authorize("admin", "super-admin"),
  [body("folderName").trim().notEmpty().withMessage("Folder name is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    ensureStorageBaseDir();
    const parentFolder = String(req.body.folder || "").trim();
    const folderName = String(req.body.folderName || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");

    const parentDir = resolveSafeStoragePath(parentFolder);
    const newDir = path.join(parentDir, folderName);

    if (fs.existsSync(newDir)) {
      return res.status(409).json({ success: false, message: "Folder already exists" });
    }

    fs.mkdirSync(newDir, { recursive: true });

    return res.status(201).json({
      success: true,
      message: "Folder created successfully",
      folderName
    });
  })
);

router.delete(
  "/storage/item",
  protect,
  authorize("admin", "super-admin"),
  [body("relativePath").trim().notEmpty().withMessage("Relative path is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    ensureStorageBaseDir();
    const targetPath = resolveSafeStoragePath(req.body.relativePath);

    if (targetPath === STORAGE_BASE_DIR) {
      return res.status(400).json({ success: false, message: "Cannot delete root storage directory" });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, message: "Storage item not found" });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      const contents = fs.readdirSync(targetPath);
      if (contents.length > 0) {
        return res.status(400).json({ success: false, message: "Directory is not empty" });
      }
      fs.rmdirSync(targetPath);
    } else {
      fs.unlinkSync(targetPath);
    }

    return res.status(200).json({
      success: true,
      message: "Item deleted from Storage"
    });
  })
);

router.get(
  "/storage/download-zip",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    ensureStorageBaseDir();
    const folderRelative = String(req.query.folder || "").trim();
    const targetPath = resolveSafeStoragePath(folderRelative);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, message: "Folder not found" });
    }

    const stat = fs.statSync(targetPath);
    const zip = new AdmZip();
    const zipName = (folderRelative ? path.basename(targetPath) : "storage_root") + ".zip";

    if (stat.isDirectory()) {
      zip.addLocalFolder(targetPath);
    } else {
      zip.addLocalFile(targetPath);
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.send(zipBuffer);
  })
);

router.post(
  "/storage/download-selected-zip",
  protect,
  authorize("admin", "super-admin"),
  [body("relativePaths").isArray().withMessage("relativePaths must be an array")],
  validateRequest,
  asyncHandler(async (req, res) => {
    ensureStorageBaseDir();
    const relativePaths = req.body.relativePaths || [];

    if (!relativePaths.length) {
      return res.status(400).json({ success: false, message: "No items selected" });
    }

    const zip = new AdmZip();

    relativePaths.forEach((relPath) => {
      const targetPath = resolveSafeStoragePath(relPath);
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          zip.addLocalFolder(targetPath, path.basename(targetPath));
        } else {
          zip.addLocalFile(targetPath);
        }
      }
    });

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="selected_storage_files.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.send(zipBuffer);
  })
);

router.get(
  "/settings",
  protect,
  authorize("super-admin", "admin"),
  asyncHandler(async (req, res) => {
    let settings = await SystemSettings.findOne({ key: "global_settings" });
    if (!settings) {
      settings = await SystemSettings.create({ key: "global_settings" });
    }
    return res.status(200).json({ success: true, settings });
  })
);

router.put(
  "/settings",
  protect,
  authorize("admin", "super-admin"),
  asyncHandler(async (req, res) => {
    let settings = await SystemSettings.findOne({ key: "global_settings" });
    if (!settings) {
      settings = new SystemSettings({ key: "global_settings" });
    }

    const allowedFields = [
      "highContrastMode",
      "fontSizeScale",
      "reducedMotion",
      "screenReaderOptimized",
      "sessionTimeout",
      "rateLimitPolicy",
      "require2FA",
      "maxLoginAttempts",
      "ipRestrictedAccess",
      "whitelistedIPs",
      "defaultCurrency",
      "hospitalAutoApproval",
      "platformTitle",
      "defaultStorageQuota",
      "tempFileCleanup",
      "totalBeds",
      "occupiedBeds",
      "icuBedsTotal",
      "icuBedsOccupied",
      "hospitalName",
      "registrationNumber",
      "emergencyContact",
      "hospitalEmail",
      "hospitalAddress",
      "ventilatorBeds",
      "operationTheatres",
      "activeOTs",
      "ambulanceCount",
      "bloodBankUnits",
      "pharmacyStatus"
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Hospital settings saved successfully",
      settings
    });
  })
);

module.exports = router;
