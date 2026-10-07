const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.join(__dirname, ".env") });

const run = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-health-management";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB:", mongoUri);

  const User = require("../models/User");

  const emailsToEnsure = [
    "superadmin@arogyaplus.com",
    "super-admin@arogyaplus.com"
  ];

  const targetPassword = "Admin@12345";

  for (const email of emailsToEnsure) {
    let user = await User.findOne({ email });
    if (user) {
      console.log(`Updating existing super admin: ${email}...`);
      user.name = "Super Admin";
      user.role = "super-admin";
      user.accessLevel = "full";
      user.isActive = true;
      user.mfaEnabled = false;
      user.totpVerified = false;
      user.totpSecret = null;
      user.password = targetPassword; // pre-save hook will hash this
      await user.save();
      console.log(`✅ Updated ${email}`);
    } else {
      console.log(`Creating new super admin: ${email}...`);
      user = await User.create({
        name: "Super Admin",
        email,
        password: targetPassword,
        role: "super-admin",
        accessLevel: "full",
        isActive: true,
        mfaEnabled: false,
        totpVerified: false,
        totpSecret: null
      });
      console.log(`✅ Created ${email}`);
    }

    // Verify password match
    const refreshed = await User.findOne({ email });
    const match = await refreshed.matchPassword(targetPassword);
    console.log(`Verification for ${email} with '${targetPassword}': ${match ? "SUCCESS" : "FAILED"}`);
  }

  await mongoose.disconnect();
  console.log("Finished successfully.");
};

run().catch((err) => {
  console.error("Error updating credentials:", err);
  process.exit(1);
});
