const mongoose = require("mongoose");

const insuranceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    providerName: {
      type: String,
      required: [true, "Insurance provider name is required"],
      trim: true
    },
    policyNumber: {
      type: String,
      required: [true, "Policy number is required"],
      trim: true
    },
    claimAmount: {
      type: Number,
      required: [true, "Claim amount is required"],
      min: 1
    },
    claimReason: {
      type: String,
      required: [true, "Claim reason is required"],
      trim: true
    },
    documents: [
      {
        type: String,
        trim: true
      }
    ],
    status: {
      type: String,
      enum: ["submitted", "under_review", "approved", "rejected"],
      default: "submitted"
    },
    adminRemark: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Insurance", insuranceSchema);
