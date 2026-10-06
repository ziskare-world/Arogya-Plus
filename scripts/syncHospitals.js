const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Hospital = require("../models/Hospital");
const User = require("../models/User");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB:", process.env.MONGO_URI);

    // Dummy hospital names removed; no need to delete placeholder entries.
    const delRes = { deletedCount: 0 };
    console.log("Deleted dummy hospitals:", delRes.deletedCount);

    const admins = await User.find({
      role: "admin",
      hospitalName: { $exists: true, $ne: "" }
    }).lean();

    for (const admin of admins) {
      const coords = admin.hospitalCoordinates || {};
      const lat = Number(coords.lat || 19.0715764);
      const lng = Number(coords.lng || 83.8095657);

      const existing = await Hospital.findOne({ name: admin.hospitalName });
      const h = await Hospital.findOneAndUpdate(
        { name: admin.hospitalName },
        {
          $set: {
            name: admin.hospitalName,
            address: admin.hospitalAddress || "Main Road, Gunupur, Rayagada, Odisha, 765022, India",
            latitude: lat,
            longitude: lng,
            phone: admin.phone || "+91-6857-220101",
            specialty: existing?.specialty || admin.department || "Multispeciality & Emergency Care",
            totalBeds: existing?.totalBeds || 100,
            occupiedBeds: existing?.occupiedBeds || 30,
            availableBeds: existing?.availableBeds || 70,
            emergencyServices: true
          }
        },
        { upsert: true, new: true }
      );

      console.log("Synced real hospital into DB:", h.name);
    }

    const currentHospitals = await Hospital.find().lean();
    console.log("Current hospitals in DB now:", currentHospitals.map(h => ({ name: h.name, address: h.address })));

    const doctors = await User.find({ role: "doctor" }).select("name hospitalName specialization").lean();
    console.log("Doctors in DB:", doctors);

    process.exit(0);
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
}

run();
