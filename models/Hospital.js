const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true
    },
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: -180,
      max: 180
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true
    },
    specialty: {
      type: String,
      default: "General Healthcare",
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    availableBeds: {
      type: Number,
      default: 10,
      min: 0
    },
    emergencyServices: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

hospitalSchema.index({ latitude: 1, longitude: 1 });
hospitalSchema.index({ name: 1 });

module.exports = mongoose.model("Hospital", hospitalSchema);
