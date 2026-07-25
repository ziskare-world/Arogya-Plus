const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param, query } = require("express-validator");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Emergency = require("../models/Emergency");
const Ambulance = require("../models/Ambulance");
const AmbulanceFleet = require("../models/AmbulanceFleet");
const Insurance = require("../models/Insurance");
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
    body("phone").optional().isString(),
    body("clinicAddress").optional().isString(),
    body("clinicCoordinates").optional().isObject().withMessage("clinicCoordinates must be an object"),
    body("clinicCoordinates.lat").optional().isFloat({ min: -90, max: 90 }),
    body("clinicCoordinates.lng").optional().isFloat({ min: -180, max: 180 })
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, specialization, clinicAddress, clinicCoordinates } =
      req.body;
    const normalizedCoordinates = normalizeCoordinates(clinicCoordinates);
    const hospitalCoordinates = normalizeCoordinates(req.user.hospitalCoordinates);

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
      clinicAddress,
      clinicCoordinates: normalizedCoordinates,
      hospitalName: req.user.hospitalName || undefined,
      hospitalCoordinates: hospitalCoordinates || undefined,
      role: "doctor",
      createdByAdmin: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Doctor account created successfully",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
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

    return res.status(200).json({
      success: true,
      count: doctors.length,
      doctors
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
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
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

module.exports = router;
