/**
 * 🤖 Arogy AI Agent - Master Subsystem Export
 */

// Initialize all skills
require("./skills");

const { agentOrchestrator, AgentOrchestrator } = require("./core/orchestrator");
const { modelAdapter, ModelAdapter } = require("./core/modelAdapter");
const { skillRegistry, SkillRegistry } = require("./core/skillRegistry");
const { toolRegistry, ToolRegistry } = require("./core/toolRegistry");
const { memoryManager, MemoryManager } = require("./core/memoryManager");
const { securityManager, SecurityManager, PERMISSION_LEVELS } = require("./core/security");
const { planningEngine, PlanningEngine } = require("./core/planner");

module.exports = {
  agentOrchestrator,
  AgentOrchestrator,
  modelAdapter,
  ModelAdapter,
  skillRegistry,
  SkillRegistry,
  toolRegistry,
  ToolRegistry,
  memoryManager,
  MemoryManager,
  securityManager,
  SecurityManager,
  planningEngine,
  PlanningEngine,
  PERMISSION_LEVELS
};
