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
    tempFileCleanup: { type: String, default: "daily" },

    // Hospital Bed Capacity & Occupancy Settings (Default 0)
    totalBeds: { type: Number, default: 0 },
    occupiedBeds: { type: Number, default: 0 },
    icuBedsTotal: { type: Number, default: 0 },
    icuBedsOccupied: { type: Number, default: 0 },

    // Hospital Profile & Infrastructure Facilities
    hospitalName: { type: String, default: "Arogya Central Hospital" },
    registrationNumber: { type: String, default: "REG-HOSP-2026-001" },
    emergencyContact: { type: String, default: "1800-112-999" },
    hospitalEmail: { type: String, default: "contact@arogyaplus.org" },
    hospitalAddress: { type: String, default: "Healthcare Avenue, Medical Enclave" },
    ventilatorBeds: { type: Number, default: 0 },
    operationTheatres: { type: Number, default: 0 },
    activeOTs: { type: Number, default: 0 },
    ambulanceCount: { type: Number, default: 0 },
    bloodBankUnits: { type: Number, default: 0 },
    pharmacyStatus: { type: String, default: "24/7 Active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
