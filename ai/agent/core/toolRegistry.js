/**
 * 🛠️ Arogy AI Agent - Tool Registry
 * Secure registry for schema-validated, permission-gated tools with audit logging and rate limiting.
 */

const { securityManager } = require("./security");

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.rateLimitMap = new Map();
  }

  /**
   * Registers a tool into the secure registry
   * @param {Object} toolDefinition
   */
  registerTool({
    name,
    description,
    inputSchema = {},
    permissionLevel = "READ_ONLY",
    timeoutMs = 10000,
    rateLimitPerMin = 60,
    execute,
    keywords = []
  }) {
    if (!name || typeof execute !== "function") {
      throw new Error(`Tool registration failed: name and execute function are required.`);
    }

    this.tools.set(name, {
      name,
      description: description || "",
      inputSchema,
      permissionLevel,
      timeoutMs,
      rateLimitPerMin,
      execute,
      keywords
    });
  }

  getTool(name) {
    return this.tools.get(name);
  }

  listTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      permissionLevel: t.permissionLevel,
      inputSchema: t.inputSchema,
      timeoutMs: t.timeoutMs,
      keywords: t.keywords
    }));
  }

  /**
   * Validates tool arguments against registered input schema
   */
  validateArgs(tool, args) {
    if (!tool.inputSchema || !tool.inputSchema.required) return true;
    for (const field of tool.inputSchema.required) {
      if (args[field] === undefined || args[field] === null) {
        throw new Error(`Missing required argument '${field}' for tool '${tool.name}'.`);
      }
    }
    return true;
  }

  /**
   * Checks tool rate limit for a specific user
   */
  checkRateLimit(user, tool) {
    const userId = user?._id?.toString() || user?.id || "anonymous";
    const key = `${userId}:${tool.name}`;
    const now = Date.now();
    const windowStart = now - 60000;

    const timestamps = (this.rateLimitMap.get(key) || []).filter(ts => ts > windowStart);
    if (timestamps.length >= tool.rateLimitPerMin) {
      throw new Error(`Rate limit exceeded for tool '${tool.name}'. Please wait before retrying.`);
    }

    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
  }

  /**
   * Safely executes a registered tool with timeout, permission checks, and audit logging
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} context - { user, executionId, isApprovedByUser }
   * @returns {Promise<Object>}
   */
  async executeTool(toolName, args = {}, context = {}) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered in Arogy AI Agent.`);
    }

    const { user, executionId = `exec_${Date.now()}`, isApprovedByUser = false } = context;
    const start = Date.now();

    // 1. Permission check
    const permCheck = securityManager.checkPermission(user, tool.permissionLevel, isApprovedByUser);
    if (!permCheck.allowed) {
      await securityManager.logAuditEvent({
        executionId,
        user,
        tool: toolName,
        permissionLevel: tool.permissionLevel,
        status: permCheck.requiresApproval ? "approval_requested" : "blocked_by_security",
        inputSummary: args,
        errorMessage: permCheck.reason
      });

      return {
        success: false,
        requiresApproval: permCheck.requiresApproval,
        reason: permCheck.reason,
        permissionLevel: tool.permissionLevel
      };
    }

    let timerId;
    try {
      // 2. Schema validation
      this.validateArgs(tool, args);

      // 3. Rate limiting
      this.checkRateLimit(user, tool);

      // 4. Timed execution
      const execPromise = tool.execute(args, context);
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error(`Execution timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs);
      });

      const result = await Promise.race([execPromise, timeoutPromise]);
      clearTimeout(timerId);
      const durationMs = Date.now() - start;

      // 5. Audit Log Success
      await securityManager.logAuditEvent({
        executionId,
        user,
        tool: toolName,
        permissionLevel: tool.permissionLevel,
        status: "success",
        inputSummary: args,
        outputSummary: result,
        durationMs
      });

      return {
        success: true,
        tool: toolName,
        data: result,
        durationMs,
        executionId
      };
    } catch (err) {
      if (timerId) clearTimeout(timerId);
      const durationMs = Date.now() - start;

      await securityManager.logAuditEvent({
        executionId,
        user,
        tool: toolName,
        permissionLevel: tool.permissionLevel,
        status: "failed",
        inputSummary: args,
        errorMessage: err.message,
        durationMs
      });

      return {
        success: false,
        tool: toolName,
        error: err.message,
        durationMs,
        executionId
      };
    }
  }
}

module.exports = {
  ToolRegistry,
  toolRegistry: new ToolRegistry()
};
