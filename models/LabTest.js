const mongoose = require("mongoose");

const labTestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Lab test name is required"],
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    category: {
      type: String,
      enum: ["Pathology", "Biochemistry", "Hematology", "Radiology", "Microbiology", "Cardiology", "General"],
      default: "General",
      index: true
    },
    description: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    turnaroundHours: {
      type: Number,
      default: 24
    },
    sampleRequired: {
      type: String,
      default: "Blood (Fasting not required)"
    },
    fastingRequired: {
      type: Boolean,
      default: false
    },
    parameters: [
      {
        name: { type: String, required: true },
        unit: { type: String, default: "" },
        referenceRange: { type: String, default: "" }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabTest", labTestSchema);
