const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: [true, "Record title is required"],
      trim: true
    },
    recordType: {
      type: String,
      trim: true,
      default: "General"
    },
    recordDate: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
    },
    documentUrl: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
