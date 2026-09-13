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
    totalBeds: {
      type: Number,
      default: 100,
      min: 0
    },
    occupiedBeds: {
      type: Number,
      default: 45,
      min: 0
    },
    availableBeds: {
      type: Number,
      default: 55,
      min: 0
    },
    icuBeds: {
      total: { type: Number, default: 20 },
      occupied: { type: Number, default: 14 },
      available: { type: Number, default: 6 }
    },
    oxygenBeds: {
      total: { type: Number, default: 35 },
      occupied: { type: Number, default: 22 },
      available: { type: Number, default: 13 }
    },
    city: {
      type: String,
      default: "Delhi NCR",
      trim: true
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 120
    },
    ambulanceContact: {
      type: String,
      default: "108"
    },
    emergencyServices: {
      type: Boolean,
      default: true
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: [77.2090, 28.6139] // [longitude, latitude]
      }
    }
  },
  { timestamps: true }
);

// Auto-sync available beds and GeoJSON coordinates before saving
hospitalSchema.pre("save", function(next) {
  if (this.totalBeds !== undefined && this.occupiedBeds !== undefined) {
    this.availableBeds = Math.max(0, this.totalBeds - this.occupiedBeds);
  }
  if (this.longitude !== undefined && this.latitude !== undefined) {
    this.location = {
      type: "Point",
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

hospitalSchema.index({ latitude: 1, longitude: 1 });
hospitalSchema.index({ location: "2dsphere" });
hospitalSchema.index({ name: 1 });
hospitalSchema.index({ city: 1 });

module.exports = mongoose.model("Hospital", hospitalSchema);
