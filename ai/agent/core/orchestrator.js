/**
 * 👑 Arogy AI Agent - Master Orchestrator
 * Central intelligence engine coordinating intent analysis, planning, skill routing,
 * memory context, tool execution, and response synthesis.
 */

const { modelAdapter } = require("./modelAdapter");
const { skillRegistry } = require("./skillRegistry");
const { toolRegistry } = require("./toolRegistry");
const { memoryManager } = require("./memoryManager");
const { securityManager } = require("./security");
const { planningEngine } = require("./planner");
const AgentTask = require("../../../models/AgentTask");

class AgentOrchestrator {
  constructor() {
    this.model = modelAdapter;
    this.skills = skillRegistry;
    this.tools = toolRegistry;
    this.memory = memoryManager;
    this.security = securityManager;
    this.planner = planningEngine;
    this.activeTasks = new Map(); // In-memory cancellation flags
  }

  /**
   * Main conversational interaction entry point
   * @param {Object} params
   * @param {string} params.message
   * @param {Object} [params.user]
   * @param {string} [params.sessionId]
   * @returns {Promise<Object>}
   */
  async processUserMessage({ message, user = null, sessionId = null }) {
    const text = String(message || "").trim();
    if (!text) {
      return {
        reply: "Hello! I am Arogy AI Agent. How can I assist you with clinical workflows, help-desk support, or tasks today?",
        skill: "general-chatbot"
      };
    }

    // 1. Security & Prompt Injection Defense
    const securityCheck = this.security.sanitizeInput(text);
    if (!securityCheck.safe) {
      return {
        reply: `⚠️ Security Notice: ${securityCheck.reason}`,
        skill: "security",
        blocked: true
      };
    }

    // 2. Memory Context Retrieval
    const userId = user?._id || user?.id || null;
    let relevantMemories = [];
    if (userId) {
      relevantMemories = await this.memory.searchMemories(userId, text);
    }

    // Short-term session history
    const sessionHistory = sessionId ? this.memory.getSessionHistory(sessionId) : [];

    // 3. Intent Classification & Skill Routing
    const intent = this.classifyIntent(text);

    // 4. Record task in MongoDB
    let taskDoc = null;
    if (userId) {
      try {
        taskDoc = await AgentTask.create({
          title: text.slice(0, 60),
          description: text,
          user: userId,
          status: "in_progress",
          skillId: intent.skill
        });
      } catch (e) {
        // Continue if DB write fails
      }
    }

    // 5. Execute Action based on Intent
    let finalResult = null;
    try {
      if (intent.tool && this.skills.isSkillEnabled(intent.skill)) {
        finalResult = await this.tools.executeTool(intent.tool, intent.args, {
          user,
          executionId: taskDoc ? taskDoc._id.toString() : `exec_${Date.now()}`
        });
      }
    } catch (err) {
      finalResult = { success: false, error: err.message };
    }

    // 6. Synthesize Response
    let reply = "";
    if (finalResult && finalResult.success) {
      reply = this._formatToolOutput(intent.tool, finalResult.data);
    } else if (finalResult && finalResult.requiresApproval) {
      reply = `🔒 **Human Approval Required**: This action (${intent.tool}) touches sensitive operations. Please confirm approval on your dashboard.`;
    } else {
      // Model-generated conversational response
      const memoryContext = relevantMemories.map(m => `${m.key}: ${JSON.stringify(m.value)}`).join("\n");
      const modelRes = await this.model.generateResponse([
        ...sessionHistory.slice(-4),
        { role: "user", content: text + (memoryContext ? `\n(Context: ${memoryContext})` : "") }
      ]);
      reply = modelRes.text;
    }

    // 7. Update Session Memory & Task Status
    if (sessionId) {
      this.memory.appendSessionMessage(sessionId, { role: "user", content: text });
      this.memory.appendSessionMessage(sessionId, { role: "assistant", content: reply });
    }

    if (taskDoc) {
      taskDoc.status = finalResult?.requiresApproval ? "awaiting_approval" : (finalResult?.success !== false ? "completed" : "failed");
      taskDoc.result = finalResult;
      await taskDoc.save();
    }

    return {
      reply,
      skill: intent.skill,
      tool: intent.tool,
      requiresApproval: finalResult?.requiresApproval || false,
      details: finalResult?.data || null,
      taskId: taskDoc?._id || null
    };
  }

  /**
   * Classifies user intent and maps to registered skill & tool
   */
  classifyIntent(message) {
    const text = message.toLowerCase();

    // Emergency / Ambulance
    if (/chest pain|unconscious|stroke|ambulance|sos|cannot breathe/i.test(text)) {
      return { skill: "healthcare-support", tool: "healthcare-support.triage_symptoms", args: { symptoms: [message] } };
    }

    // Help-Desk Support Tickets
    if (/support ticket|create ticket|raise a ticket|issue with|bug report/i.test(text)) {
      return {
        skill: "helpdesk-support",
        tool: "helpdesk-support.create_ticket",
        args: { title: message.slice(0, 50), description: message, category: "technical" }
      };
    }
    if (/faq|help desk|how to|frequently asked/i.test(text)) {
      return { skill: "helpdesk-support", tool: "helpdesk-support.search_faq", args: { query: message } };
    }

    // Appointments & Healthcare
    if (/appointment|book doctor|consult doctor|schedule clinic/i.test(text)) {
      return { skill: "healthcare-support", tool: "healthcare-support.book_appointment", args: { prompt: message } };
    }

    // Workflows & Automation
    if (/run workflow|automation|execute workflow/i.test(text)) {
      return { skill: "automation-engine", tool: "automation-engine.execute_workflow", args: { name: message } };
    }

    // Knowledge Base / RAG Document Search
    if (/search document|knowledge base|find in docs|policy doc/i.test(text)) {
      return { skill: "document-knowledge", tool: "document-knowledge.search_knowledge", args: { query: message } };
    }

    // Projects & Tasks
    if (/create project|add task|project status|milestone/i.test(text)) {
      return { skill: "project-management", tool: "project-management.manage_task", args: { title: message } };
    }

    // System Monitoring
    if (/system status|service health|system health|server load/i.test(text)) {
      return { skill: "system-monitoring", tool: "system-monitoring.check_health", args: {} };
    }

    return { skill: "general-chatbot", tool: "general-chatbot.chat", args: { message } };
  }

  _formatToolOutput(toolName, data) {
    if (!data) return "Action completed successfully.";
    if (typeof data === "string") return data;
    if (data.reply) return data.reply;
    if (data.message) return data.message;
    if (data.summary) return data.summary;
    return `Completed action '${toolName}':\n${JSON.stringify(data, null, 2)}`;
  }

  /**
   * Cancels a running task
   */
  async cancelTask(taskId) {
    this.activeTasks.set(taskId, true);
    const task = await AgentTask.findById(taskId);
    if (task) {
      task.status = "cancelled";
      await task.save();
      return true;
    }
    return false;
  }
}

module.exports = {
  AgentOrchestrator,
  agentOrchestrator: new AgentOrchestrator()
};
