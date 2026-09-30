const AuditLog = require("../models/AuditLog");

/**
 * Record an audit log entry asynchronously.
 * Safe to fire-and-forget; handles errors internally.
 */
const logAudit = async ({
  action,
  category = "SYSTEM",
  severity = "info",
  details = "",
  actor = null,
  targetId = null,
  ipAddress = "127.0.0.1",
  hospital = null,
  hospitalName = "",
  req = null
}) => {
  try {
    let resolvedActor = {
      name: "System",
      role: "system",
      email: ""
    };

    let resolvedIp = ipAddress;
    let resolvedHospital = hospital;
    let resolvedHospitalName = hospitalName;

    if (req) {
      resolvedIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        "127.0.0.1";

      if (req.user) {
        resolvedActor = {
          id: req.user._id || req.user.id,
          name: req.user.name || "Authenticated User",
          role: req.user.role || "user",
          email: req.user.email || ""
        };
        if (!resolvedHospital && req.user.hospital) {
          resolvedHospital = req.user.hospital;
        }
        if (!resolvedHospitalName && req.user.hospitalName) {
          resolvedHospitalName = req.user.hospitalName;
        }
      }
    }

    if (actor) {
      resolvedActor = { ...resolvedActor, ...actor };
    }

    await AuditLog.create({
      action,
      category,
      severity,
      details,
      actor: resolvedActor,
      targetId: targetId ? String(targetId) : null,
      ipAddress: resolvedIp,
      hospital: resolvedHospital,
      hospitalName: resolvedHospitalName
    });
  } catch (err) {
    console.error("[AuditLog Error]", err.message);
  }
};

module.exports = { logAudit };
