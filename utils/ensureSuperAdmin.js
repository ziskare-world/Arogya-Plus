const User = require("../models/User");

const DEFAULT_SUPER_ADMIN_EMAIL = "superadmin@arogyaplus.com";
const DEFAULT_SUPER_ADMIN_PASSWORD = "Admin@12345";
const DEFAULT_SUPER_ADMIN_NAME = "Super Admin";

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const ensureSuperAdmin = async () => {
  const configuredEmail = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL);
  const password = String(process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD);
  const name = String(process.env.SUPER_ADMIN_NAME || DEFAULT_SUPER_ADMIN_NAME).trim() || DEFAULT_SUPER_ADMIN_NAME;

  if (password.length < 6) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 6 characters");
  }

  // Ensure both email variants exist and are functional
  const emailsToEnsure = Array.from(new Set([
    configuredEmail,
    "superadmin@arogyaplus.com",
    "super-admin@arogyaplus.com"
  ]));

  let primarySuperAdmin = null;

  for (const email of emailsToEnsure) {
    let user = await User.findOne({ email });
    if (user) {
      user.name = name;
      user.role = "super-admin";
      user.accessLevel = "full";
      user.isActive = true;
      user.mfaEnabled = false;
      user.totpVerified = false;
      user.totpSecret = null;
      user.password = password; // Hashed by pre-save hook
      await user.save();
      console.log(`[Auth] Super admin synced: ${email}`);
      if (!primarySuperAdmin) primarySuperAdmin = user;
    } else {
      user = await User.create({
        name,
        email,
        password,
        role: "super-admin",
        accessLevel: "full",
        isActive: true,
        mfaEnabled: false,
        totpVerified: false,
        totpSecret: null
      });
      console.log(`[Auth] Super admin created: ${email}`);
      if (!primarySuperAdmin) primarySuperAdmin = user;
    }
  }

  const superAdmin = primarySuperAdmin;

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
