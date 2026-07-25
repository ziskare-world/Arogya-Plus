const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    keys: {
      p256dh: {
        type: String,
        required: true
      },
      auth: {
        type: String,
        required: true
      }
    },
    expirationTime: {
      type: Number,
      default: null
    },
    userAgent: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
