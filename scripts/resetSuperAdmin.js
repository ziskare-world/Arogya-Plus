const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");

const resetSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-health-management";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB:", mongoUri);

    const emails = ["superadmin@arogyaplus.com", "super-admin@arogyaplus.com"];
    const password = process.env.SUPER_ADMIN_PASSWORD || "Admin@12345";

    for (const email of emails) {
      let user = await User.findOne({ email });

      if (user) {
        console.log(`Resetting existing user: ${email}...`);
        user.password = password; // Will be hashed by pre-save hook
        user.mfaEnabled = false;
        user.totpVerified = false;
        user.totpSecret = null;
        user.isActive = true;
        user.role = "super-admin";
        user.accessLevel = "full";
        await user.save();
        console.log(`✅ Super Admin account reset successfully: ${email}`);
      } else {
        console.log(`Creating new Super Admin: ${email}...`);
        user = await User.create({
          name: "Super Admin",
          email,
          password,
          role: "super-admin",
          accessLevel: "full",
          isActive: true,
          mfaEnabled: false,
          totpVerified: false,
          totpSecret: null
        });
        console.log(`✅ Super Admin account created successfully: ${email}`);
      }
    }

    console.log(`\n==========================================`);
    console.log(`📧 Emails:   ${emails.join(", ")}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🛡️ 2FA:      Reset to OFF`);
    console.log(`==========================================\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset error:", err);
    process.exit(1);
  }
};

resetSuperAdmin();
