const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Hospital = require("../models/Hospital");
const User = require("../models/User");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB:", process.env.MONGO_URI);

    const dummyNames = [
      "Arogya Central Multi-Specialty Hospital",
      "City Care Trauma & Emergency Center",
      "Metro Health Super Specialty Clinic",
      "Apex Blood Bank & Urgent Care"
    ];

    const delRes = await Hospital.deleteMany({ name: { $in: dummyNames } });
    console.log("Deleted dummy hospitals:", delRes.deletedCount);

    const admins = await User.find({
      role: "admin",
      hospitalName: { $exists: true, $ne: "" }
    }).lean();

    for (const admin of admins) {
      const coords = admin.hospitalCoordinates || {};
      const lat = Number(coords.lat || 19.0715764);
      const lng = Number(coords.lng || 83.8095657);

      const h = await Hospital.findOneAndUpdate(
        { name: admin.hospitalName },
        {
          $set: {
            name: admin.hospitalName,
            address: admin.hospitalAddress || "hospital road, Gunupur Town, Ketalugurha, Gunupur, Rayagada, Odisha, 765022, India",
            latitude: lat,
            longitude: lng,
            phone: admin.phone || "+91-11-23456789",
            specialty: "Neurology & Multi-Specialty",
            totalBeds: 100,
            occupiedBeds: 14,
            availableBeds: 86,
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
