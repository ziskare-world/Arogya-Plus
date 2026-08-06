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

    const email = "super-admin@arogyaplus.com";
    const password = "123456";

    let user = await User.findOne({ email });

    if (user) {
      console.log(`Resetting existing user: ${email}...`);
      user.password = password; // Will be hashed by pre-save hook or manually
      user.mfaEnabled = false;
      user.totpVerified = false;
      user.totpSecret = null;
      user.passkeys = [];
      user.isActive = true;
      user.role = "super-admin";
      await user.save();
      console.log("✅ Super Admin account reset successfully!");
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
        totpSecret: null,
        passkeys: []
      });
      console.log("✅ Super Admin account created successfully!");
    }

    console.log(`\n==========================================`);
    console.log(`📧 Email:    ${email}`);
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
