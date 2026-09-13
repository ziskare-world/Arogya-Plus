/**
 * 🛡️ Arogy AI Agent - Security & Permission Engine
 * Implements 5-tier permission governance, prompt injection defense, and audit logging.
 */

const AgentAuditLog = require("../../../models/AgentAuditLog");

const PERMISSION_LEVELS = {
  READ_ONLY: 1,
  DRAFT_ONLY: 2,
  USER_APPROVAL_REQUIRED: 3,
  ADMIN_APPROVAL_REQUIRED: 4,
  FULLY_AUTOMATED_APPROVED_TASK: 5
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|unfiltered)/i,
  /disregard\s+(all\s+)?rules/i,
  /bypass\s+security\s+filter/i,
  /<script[\s\S]*?>[\s\S]*?<\/script>/i
];

class SecurityManager {
  constructor() {
    this.permissionLevels = PERMISSION_LEVELS;
  }

  /**
   * Scans input text for known prompt injection attempts
   * @param {string} text
   * @returns {{safe: boolean, reason?: string}}
   */
  sanitizeInput(text) {
    if (!text || typeof text !== "string") return { safe: true, text: "" };

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          safe: false,
          reason: "Input triggered prompt injection security filter."
        };
      }
    }

    return {
      safe: true,
      text: text.trim()
    };
  }

  /**
   * Checks if a user has sufficient permission for a given tool/skill
   * @param {Object} user - Authenticated user document or object
   * @param {string} permissionLevel - Target permission requirement
   * @param {boolean} [isApprovedByUser=false] - Has human approval been granted
   * @returns {{allowed: boolean, requiresApproval: boolean, reason?: string}}
   */
  checkPermission(user, permissionLevel = "READ_ONLY", isApprovedByUser = false) {
    const role = user?.role || "patient";

    switch (permissionLevel) {
      case "READ_ONLY":
      case "DRAFT_ONLY":
        return { allowed: true, requiresApproval: false };

      case "USER_APPROVAL_REQUIRED":
        if (isApprovedByUser) {
          return { allowed: true, requiresApproval: false };
        }
        return {
          allowed: false,
          requiresApproval: true,
          reason: "This action requires explicit user confirmation before execution."
        };

      case "ADMIN_APPROVAL_REQUIRED":
        if (role === "admin" || role === "superadmin") {
          return { allowed: true, requiresApproval: false };
        }
        if (isApprovedByUser && user?.approvedByAdmin) {
          return { allowed: true, requiresApproval: false };
        }
        return {
          allowed: false,
          requiresApproval: true,
          reason: "This sensitive action requires administrative review and approval."
        };

      case "FULLY_AUTOMATED_APPROVED_TASK":
        return { allowed: true, requiresApproval: false };

      default:
        return { allowed: true, requiresApproval: false };
    }
  }

  /**
   * Records a security/execution event into the audit log
   */
  async logAuditEvent({
    executionId,
    user,
    skill,
    tool,
    action,
    permissionLevel,
    status,
    inputSummary,
    outputSummary,
    errorMessage,
    durationMs = 0,
    ipAddress = ""
  }) {
    try {
      if (AgentAuditLog && typeof AgentAuditLog.create === "function") {
        await AgentAuditLog.create({
          executionId: executionId || `exec_${Date.now()}`,
          user: user?._id || user?.id || null,
          skill,
          tool,
          action,
          permissionLevel,
          status,
          inputSummary: this._sanitizeForAudit(inputSummary),
          outputSummary: this._sanitizeForAudit(outputSummary),
          errorMessage,
          durationMs,
          ipAddress
        });
      }
    } catch (err) {
      console.error("[SecurityManager] Failed to write audit log:", err.message);
    }
  }

  _sanitizeForAudit(data) {
    if (!data) return null;
    const sanitized = JSON.parse(JSON.stringify(data));
    const redactKeys = ["password", "token", "secret", "cvv", "apiKey", "creditCard"];

    const walk = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        if (redactKeys.some(r => key.toLowerCase().includes(r.toLowerCase()))) {
          obj[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object") {
          walk(obj[key]);
        }
      }
    };

    walk(sanitized);
    return sanitized;
  }
}

module.exports = {
  SecurityManager,
  securityManager: new SecurityManager(),
  PERMISSION_LEVELS
};
