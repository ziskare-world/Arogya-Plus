/**
 * 📋 Arogy AI Agent - Planning & Execution Engine
 * Generates and executes multi-step plans with dependency management, retry policies,
 * human approval gates, and loop prevention safeguards.
 */

const ExecutionPlan = require("../../../models/ExecutionPlan");
const ApprovalRequest = require("../../../models/ApprovalRequest");
const { toolRegistry } = require("./toolRegistry");
const { securityManager } = require("./security");

class PlanningEngine {
  constructor() {
    this.maxExecutionSteps = 10; // Prevent infinite loops
  }

  /**
   * Constructs an execution plan for a given user goal and intent
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createPlan({ taskId, user, goal, steps = [] }) {
    if (steps.length === 0) {
      // Default single-step execution
      steps = [
        {
          stepId: "step_1",
          skill: "general-chatbot",
          tool: "general-chatbot.chat",
          description: `Address user goal: ${goal}`,
          arguments: { message: goal },
          permissionLevel: "READ_ONLY",
          status: "pending"
        }
      ];
    }

    const plan = await ExecutionPlan.create({
      task: taskId,
      user: user?._id || user?.id,
      goal,
      status: "active",
      steps
    });

    return plan;
  }

  /**
   * Executes a plan sequentially with approval checkpoints and failure recovery
   * @param {string} planId
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async executePlan(planId, context = {}) {
    const plan = await ExecutionPlan.findById(planId);
    if (!plan) throw new Error("Plan not found");

    if (plan.status === "cancelled") {
      return { success: false, message: "Plan execution has been cancelled." };
    }

    let iterations = 0;
    const executionResults = [];

    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      if (iterations++ >= this.maxExecutionSteps) {
        plan.status = "failed";
        await plan.save();
        throw new Error("Loop detection triggered: exceeded maximum allowed execution steps (10).");
      }

      const step = plan.steps[i];
      if (step.status === "completed") continue;

      // 1. Check if step requires human approval checkpoint
      const permLevel = step.permissionLevel || "READ_ONLY";
      const permCheck = securityManager.checkPermission(context.user, permLevel, context.isApprovedByUser);

      if (!permCheck.allowed && permCheck.requiresApproval) {
        step.status = "waiting_approval";
        plan.currentStepIndex = i;
        await plan.save();

        // Create approval request in database
        const approval = await ApprovalRequest.create({
          task: plan.task,
          planId: plan._id,
          stepId: step.stepId,
          user: context.user?._id || context.user?.id,
          actionName: step.tool,
          skillName: step.skill,
          permissionLevel: permLevel,
          details: {
            goal: plan.goal,
            stepDescription: step.description,
            arguments: step.arguments
          },
          status: "pending"
        });

        return {
          status: "awaiting_approval",
          message: "Human approval required to proceed with sensitive action.",
          approvalId: approval._id,
          step: step.stepId,
          permissionLevel: permLevel
        };
      }

      // 2. Execute tool
      step.status = "in_progress";
      await plan.save();

      let stepSuccess = false;
      let retries = 0;

      while (!stepSuccess && retries <= (step.maxRetries || 1)) {
        const result = await toolRegistry.executeTool(step.tool, step.arguments, {
          ...context,
          executionId: `${plan._id}_${step.stepId}`
        });

        if (result.success) {
          step.status = "completed";
          step.output = result.data;
          stepSuccess = true;
          executionResults.push(result);
        } else {
          retries++;
          step.retryCount = retries;
          step.error = result.error || result.reason;

          if (retries > (step.maxRetries || 1)) {
            step.status = "failed";
            plan.status = "failed";
            await plan.save();

            return {
              status: "failed",
              error: `Step '${step.stepId}' (${step.tool}) failed: ${step.error}`,
              executionResults
            };
          }
        }
      }

      plan.currentStepIndex = i + 1;
      await plan.save();
    }

    plan.status = "completed";
    await plan.save();

    return {
      status: "completed",
      results: executionResults,
      planId: plan._id
    };
  }

  /**
   * Resumes a paused execution plan after an approval request is approved
   */
  async resumeAfterApproval(approvalId, context = {}) {
    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval || approval.status !== "approved") {
      throw new Error("Invalid or unapproved request");
    }

    return await this.executePlan(approval.planId, {
      ...context,
      isApprovedByUser: true
    });
  }
}

module.exports = {
  PlanningEngine,
  planningEngine: new PlanningEngine()
};
