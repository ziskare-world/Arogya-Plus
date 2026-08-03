const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global_settings", unique: true },

    // Accessibility Controls
    highContrastMode: { type: Boolean, default: false },
    fontSizeScale: { type: String, enum: ["standard", "medium", "large"], default: "standard" },
    reducedMotion: { type: Boolean, default: false },
    screenReaderOptimized: { type: Boolean, default: true },

    // Security & Access Control
    sessionTimeout: { type: String, default: "24h" },
    rateLimitPolicy: { type: String, enum: ["strict", "relaxed", "disabled"], default: "strict" },
    require2FA: { type: Boolean, default: false },
    maxLoginAttempts: { type: Number, default: 5 },
    ipRestrictedAccess: { type: Boolean, default: false },
    whitelistedIPs: { type: [String], default: [] },

    // Hospital Network & Storage Preferences
    defaultCurrency: { type: String, default: "INR" },
    hospitalAutoApproval: { type: String, enum: ["manual", "auto"], default: "manual" },
    platformTitle: { type: String, default: "Arogya Plus Healthcare Platform" },
    defaultStorageQuota: { type: String, default: "5GB" },
    tempFileCleanup: { type: String, default: "daily" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
