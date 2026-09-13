const Workflow = require("../../../../models/Workflow");
const WorkflowExecution = require("../../../../models/WorkflowExecution");
const { toolRegistry } = require("../../core/toolRegistry");

const tools = [
  {
    name: "automation-engine.create_workflow",
    description: "Creates and saves a structured automation workflow",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        triggerType: { type: "string" },
        triggerExpression: { type: "string" },
        steps: { type: "array" }
      },
      required: ["name", "steps"]
    },
    permissionLevel: "USER_APPROVAL_REQUIRED",
    keywords: ["create workflow", "new automation", "build workflow"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (!userId) throw new Error("Authenticated user required to create workflows.");

      const workflow = await Workflow.create({
        name: args.name,
        description: args.description || "",
        user: userId,
        trigger: {
          type: args.triggerType || "manual",
          expression: args.triggerExpression || ""
        },
        steps: args.steps
      });

      return {
        success: true,
        workflowId: workflow._id,
        name: workflow.name,
        stepCount: workflow.steps.length,
        message: `Workflow '${workflow.name}' created successfully.`
      };
    }
  },
  {
    name: "automation-engine.execute_workflow",
    description: "Executes an approved workflow step-by-step",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string" }
      }
    },
    permissionLevel: "READ_ONLY",
    keywords: ["run workflow", "trigger workflow", "execute automation"],
    execute: async (args, context = {}) => {
      let wf = null;
      if (args.workflowId) {
        wf = await Workflow.findById(args.workflowId);
      } else {
        wf = await Workflow.findOne({ isActive: true, isPaused: false });
      }

      if (!wf) {
        return {
          success: false,
          error: "No active workflow found to execute."
        };
      }

      if (wf.isPaused) {
        return {
          success: false,
          error: `Workflow '${wf.name}' is currently paused.`
        };
      }

      const execution = await WorkflowExecution.create({
        workflow: wf._id,
        triggeredBy: "manual",
        status: "running",
        stepResults: []
      });

      const start = Date.now();
      const stepResults = [];

      for (const step of wf.steps) {
        const stepStart = Date.now();
        const toolName = `${step.skill}.${step.action}`;
        try {
          const res = await toolRegistry.executeTool(toolName, step.arguments || {}, context);
          stepResults.push({
            stepId: step.stepId || toolName,
            skill: step.skill,
            action: step.action,
            status: res.success ? "completed" : "failed",
            output: res.data || res.error,
            durationMs: Date.now() - stepStart
          });
        } catch (e) {
          stepResults.push({
            stepId: step.stepId || toolName,
            skill: step.skill,
            action: step.action,
            status: "failed",
            error: e.message,
            durationMs: Date.now() - stepStart
          });
          if (!step.continueOnError) break;
        }
      }

      const totalDuration = Date.now() - start;
      const allPassed = stepResults.every(r => r.status === "completed");

      execution.status = allPassed ? "completed" : "failed";
      execution.stepResults = stepResults;
      execution.durationMs = totalDuration;
      await execution.save();

      wf.lastExecutedAt = new Date();
      wf.executionCount = (wf.executionCount || 0) + 1;
      await wf.save();

      return {
        success: allPassed,
        workflowId: wf._id,
        workflowName: wf.name,
        executionId: execution._id,
        totalDurationMs: totalDuration,
        stepResults
      };
    }
  },
  {
    name: "automation-engine.list_workflows",
    description: "Lists all configured automation workflows",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["list workflows", "all automations"],
    execute: async (args, context = {}) => {
      const list = await Workflow.find().sort({ createdAt: -1 }).limit(20).lean();
      return { workflows: list };
    }
  }
];

module.exports = { tools };
