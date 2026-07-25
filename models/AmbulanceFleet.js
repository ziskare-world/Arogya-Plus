const mongoose = require("mongoose");

const ambulanceFleetSchema = new mongoose.Schema(
  {
    hospitalName: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true
    },
    hospitalAddress: {
      type: String,
      trim: true
    },
    hospitalCoordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    vehicleNumber: {
      type: String,
      required: [true, "Vehicle number is required"],
      trim: true,
      uppercase: true
    },
    driverName: {
      type: String,
      trim: true
    },
    driverPhone: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ["available", "dispatched", "maintenance", "inactive"],
      default: "available"
    },
    currentCoordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    lastAssignedAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

ambulanceFleetSchema.index({ vehicleNumber: 1 }, { unique: true });
ambulanceFleetSchema.index({ hospitalName: 1, status: 1 });

module.exports = mongoose.model("AmbulanceFleet", ambulanceFleetSchema);
