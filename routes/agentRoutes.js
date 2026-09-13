/**
 * 🚀 Arogy AI Agent - Full REST API
 * Secure, authenticated endpoints for conversational chat, planning, skills, tools,
 * approvals, workflows, memory, and telemetry.
 */

const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param } = require("express-validator");
const validateRequest = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");

const {
  agentOrchestrator,
  modelAdapter,
  skillRegistry,
  toolRegistry,
  memoryManager,
  planningEngine
} = require("../ai/agent");

const AgentTask = require("../models/AgentTask");
const ExecutionPlan = require("../models/ExecutionPlan");
const ApprovalRequest = require("../models/ApprovalRequest");
const Workflow = require("../models/Workflow");
const WorkflowExecution = require("../models/WorkflowExecution");

const router = express.Router();

/**
 * Optional authentication middleware helper (allows public chat demo while attaching user when logged in)
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const jwt = require("jsonwebtoken");
      const User = require("../models/User");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (e) {
      // Continue without user
    }
  }
  next();
};

/**
 * @route   POST /api/agent/chat
 * @desc    Main chat interaction with Arogy AI Agent
 */
router.post(
  "/chat",
  optionalAuth,
  [
    body("message").isString().trim().notEmpty().withMessage("Message is required"),
    body("sessionId").optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await agentOrchestrator.processUserMessage({
      message: req.body.message,
      user: req.user || null,
      sessionId: req.body.sessionId || null
    });
    return res.status(200).json({ success: true, ...result });
  })
);

/**
 * @route   POST /api/agent/plan
 * @desc    Constructs a multi-step execution plan for a complex task
 */
router.post(
  "/plan",
  protect,
  [
    body("goal").isString().trim().notEmpty().withMessage("Goal is required"),
    body("steps").optional().isArray()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const task = await AgentTask.create({
      title: req.body.goal.slice(0, 50),
      description: req.body.goal,
      user: req.user._id,
      status: "planning"
    });

    const plan = await planningEngine.createPlan({
      taskId: task._id,
      user: req.user,
      goal: req.body.goal,
      steps: req.body.steps || []
    });

    task.planId = plan._id;
    task.status = "in_progress";
    await task.save();

    return res.status(201).json({ success: true, taskId: task._id, plan });
  })
);

/**
 * @route   POST /api/agent/execute
 * @desc    Executes an existing execution plan
 */
router.post(
  "/execute",
  protect,
  [
    body("planId").isMongoId().withMessage("Valid planId is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const execution = await planningEngine.executePlan(req.body.planId, {
      user: req.user
    });
    return res.status(200).json({ success: true, execution });
  })
);

/**
 * @route   GET /api/agent/tasks/:id
 * @desc    Retrieves task status and step progress
 */
router.get(
  "/tasks/:id",
  protect,
  asyncHandler(async (req, res) => {
    const task = await AgentTask.findById(req.params.id).populate("planId");
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.status(200).json({ success: true, task });
  })
);

/**
 * @route   POST /api/agent/tasks/:id/cancel
 * @desc    Cancels a running task
 */
router.post(
  "/tasks/:id/cancel",
  protect,
  asyncHandler(async (req, res) => {
    const cancelled = await agentOrchestrator.cancelTask(req.params.id);
    return res.status(200).json({ success: cancelled, message: "Task cancelled" });
  })
);

/**
 * @route   GET /api/agent/skills
 * @desc    List all discovered skills and their statuses
 */
router.get(
  "/skills",
  asyncHandler(async (req, res) => {
    const skills = skillRegistry.listSkills();
    return res.status(200).json({ success: true, count: skills.length, skills });
  })
);

/**
 * @route   POST /api/agent/skills/:id/enable
 * @desc    Enables a skill
 */
router.post(
  "/skills/:id/enable",
  protect,
  asyncHandler(async (req, res) => {
    const enabled = skillRegistry.enableSkill(req.params.id);
    return res.status(200).json({ success: enabled, skillId: req.params.id, status: "enabled" });
  })
);

/**
 * @route   POST /api/agent/skills/:id/disable
 * @desc    Disables a skill
 */
router.post(
  "/skills/:id/disable",
  protect,
  asyncHandler(async (req, res) => {
    const disabled = skillRegistry.disableSkill(req.params.id);
    return res.status(200).json({ success: disabled, skillId: req.params.id, status: "disabled" });
  })
);

/**
 * @route   GET /api/agent/tools
 * @desc    List all registered secure tools
 */
router.get(
  "/tools",
  asyncHandler(async (req, res) => {
    const tools = toolRegistry.listTools();
    return res.status(200).json({ success: true, count: tools.length, tools });
  })
);

/**
 * @route   GET /api/agent/memory
 * @desc    Retrieves long-term memories for authenticated user
 */
router.get(
  "/memory",
  protect,
  asyncHandler(async (req, res) => {
    const memories = await memoryManager.getMemories(req.user._id, req.query.category || null);
    return res.status(200).json({ success: true, count: memories.length, memories });
  })
);

/**
 * @route   DELETE /api/agent/memory/:id
 * @desc    Deletes a memory item (User Privacy Control)
 */
router.delete(
  "/memory/:id",
  protect,
  asyncHandler(async (req, res) => {
    const deleted = await memoryManager.deleteMemory(req.params.id, req.user._id);
    return res.status(200).json({ success: Boolean(deleted), message: "Memory entry deleted." });
  })
);

/**
 * @route   GET /api/agent/approvals
 * @desc    List pending human approval requests
 */
router.get(
  "/approvals",
  protect,
  asyncHandler(async (req, res) => {
    const approvals = await ApprovalRequest.find({
      user: req.user._id,
      status: "pending"
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: approvals.length, approvals });
  })
);

/**
 * @route   POST /api/agent/approvals/:id/approve
 * @desc    Approves a sensitive action checkpoint and resumes plan
 */
router.post(
  "/approvals/:id/approve",
  protect,
  asyncHandler(async (req, res) => {
    const approval = await ApprovalRequest.findById(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: "Approval request not found" });

    approval.status = "approved";
    approval.reviewedBy = req.user._id;
    approval.reviewedAt = new Date();
    await approval.save();

    let resumeResult = null;
    if (approval.planId) {
      resumeResult = await planningEngine.resumeAfterApproval(approval._id, { user: req.user });
    }

    return res.status(200).json({
      success: true,
      message: "Action approved and resumed.",
      approval,
      resumeResult
    });
  })
);

/**
 * @route   POST /api/agent/approvals/:id/reject
 * @desc    Rejects a sensitive action checkpoint
 */
router.post(
  "/approvals/:id/reject",
  protect,
  asyncHandler(async (req, res) => {
    const approval = await ApprovalRequest.findById(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: "Approval request not found" });

    approval.status = "rejected";
    approval.reviewedBy = req.user._id;
    approval.reviewedAt = new Date();
    approval.reason = req.body.reason || "Rejected by user";
    await approval.save();

    return res.status(200).json({ success: true, message: "Action rejected.", approval });
  })
);

/**
 * @route   GET /api/agent/workflows
 * @desc    List all workflows
 */
router.get(
  "/workflows",
  protect,
  asyncHandler(async (req, res) => {
    const workflows = await Workflow.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: workflows.length, workflows });
  })
);

/**
 * @route   POST /api/agent/workflows
 * @desc    Create an automation workflow
 */
router.post(
  "/workflows",
  protect,
  [
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("steps").isArray({ min: 1 }).withMessage("Steps array required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const workflow = await Workflow.create({
      name: req.body.name,
      description: req.body.description || "",
      user: req.user._id,
      trigger: req.body.trigger || { type: "manual" },
      steps: req.body.steps
    });
    return res.status(201).json({ success: true, workflow });
  })
);

/**
 * @route   POST /api/agent/workflows/:id/pause
 * @desc    Pause workflow
 */
router.post(
  "/workflows/:id/pause",
  protect,
  asyncHandler(async (req, res) => {
    const wf = await Workflow.findByIdAndUpdate(req.params.id, { isPaused: true }, { new: true });
    return res.status(200).json({ success: true, workflow: wf });
  })
);

/**
 * @route   POST /api/agent/workflows/:id/resume
 * @desc    Resume workflow
 */
router.post(
  "/workflows/:id/resume",
  protect,
  asyncHandler(async (req, res) => {
    const wf = await Workflow.findByIdAndUpdate(req.params.id, { isPaused: false }, { new: true });
    return res.status(200).json({ success: true, workflow: wf });
  })
);

/**
 * @route   GET /api/agent/executions
 * @desc    List workflow execution history
 */
router.get(
  "/executions",
  protect,
  asyncHandler(async (req, res) => {
    const executions = await WorkflowExecution.find().populate("workflow", "name").sort({ createdAt: -1 }).limit(30);
    return res.status(200).json({ success: true, count: executions.length, executions });
  })
);

/**
 * @route   GET /api/agent/health
 * @desc    Health check reporting model, skills, and memory stats
 */
router.get(
  "/health",
  asyncHandler(async (req, res) => {
    const modelHealth = await modelAdapter.checkModelHealth();
    return res.status(200).json({
      success: true,
      agent: "Arogy AI Agent",
      version: "2.5.0",
      status: "operational",
      model: modelHealth,
      skillsRegistered: skillRegistry.listSkills().length,
      toolsRegistered: toolRegistry.listTools().length,
      timestamp: new Date().toISOString()
    });
  })
);

module.exports = router;
