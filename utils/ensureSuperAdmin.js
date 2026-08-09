const User = require("../models/User");

const DEFAULT_SUPER_ADMIN_EMAIL = "super-admin@arogyaplus.com";
const DEFAULT_SUPER_ADMIN_PASSWORD = "123456";
const DEFAULT_SUPER_ADMIN_NAME = "Super Admin";

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const ensureSuperAdmin = async () => {
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL);
  const password = String(process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD);
  const name = String(process.env.SUPER_ADMIN_NAME || DEFAULT_SUPER_ADMIN_NAME).trim() || DEFAULT_SUPER_ADMIN_NAME;

  if (password.length < 6) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 6 characters");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    let shouldSave = false;

    if (existing.role !== "super-admin") {
      existing.role = "super-admin";
      shouldSave = true;
    }

    if (!existing.isActive) {
      existing.isActive = true;
      shouldSave = true;
    }

    if (shouldSave) {
      await existing.save();
      console.log(`[Auth] Super admin updated: ${email}`);
    }

    return existing;
  }

  const superAdmin = await User.create({
    name,
    email,
    password,
    role: "super-admin",
    accessLevel: "full",
    isActive: true
  });

  // Clean up legacy doctor ratings/reviews defaults if any doctors were created with old static defaults
  try {
    const Appointment = require("../models/Appointment");
    const doctors = await User.find({ role: "doctor" }).select("_id rating reviewCount");
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

    const ratedDoctorIds = new Set(ratingsAgg.map((item) => String(item._id)));
    const unratedDoctorIds = doctorIds.filter((id) => !ratedDoctorIds.has(String(id)));

    if (unratedDoctorIds.length > 0) {
      await User.updateMany(
        { _id: { $in: unratedDoctorIds } },
        { $set: { rating: 0, reviewCount: 0 } }
      );
    }
  } catch (err) {
    console.error("[Migration] Legacy doctor rating cleanup notice:", err.message);
  }

  return superAdmin;
};

module.exports = ensureSuperAdmin;
