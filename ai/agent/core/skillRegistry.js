/**
 * 📦 Arogy AI Agent - Skill Registry
 * Manages modular skill discovery, manifests, status (enabled/disabled), and action dispatching.
 */

const fs = require("fs");
const path = require("path");
const { toolRegistry } = require("./toolRegistry");

class SkillRegistry {
  constructor() {
    this.skills = new Map();
    this.enabledSkills = new Set();
  }

  /**
   * Registers a skill definition into the registry
   * @param {Object} skill
   */
  registerSkill(skill) {
    if (!skill.id || !skill.name) {
      throw new Error("Skill registration requires 'id' and 'name'.");
    }

    const normalizedSkill = {
      id: skill.id,
      name: skill.name,
      description: skill.description || "",
      version: skill.version || "1.0.0",
      category: skill.category || "general",
      requiredPermissions: skill.requiredPermissions || ["READ_ONLY"],
      requiresApproval: Boolean(skill.requiresApproval),
      tools: skill.tools || [],
      handler: skill.handler || null,
      validator: skill.validator || null,
      isEnabled: true
    };

    this.skills.set(skill.id, normalizedSkill);
    this.enabledSkills.add(skill.id);

    // Register all skill tools into toolRegistry
    if (Array.isArray(skill.tools)) {
      for (const t of skill.tools) {
        toolRegistry.registerTool({
          ...t,
          name: t.name.includes(".") ? t.name : `${skill.id}.${t.name}`,
          permissionLevel: t.permissionLevel || (skill.requiresApproval ? "USER_APPROVAL_REQUIRED" : "READ_ONLY")
        });
      }
    }
  }

  getSkill(skillId) {
    return this.skills.get(skillId);
  }

  listSkills() {
    return Array.from(this.skills.values()).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      version: s.version,
      category: s.category,
      requiredPermissions: s.requiredPermissions,
      requiresApproval: s.requiresApproval,
      isEnabled: this.enabledSkills.has(s.id),
      toolsCount: (s.tools || []).length
    }));
  }

  enableSkill(skillId) {
    if (!this.skills.has(skillId)) return false;
    this.enabledSkills.add(skillId);
    this.skills.get(skillId).isEnabled = true;
    return true;
  }

  disableSkill(skillId) {
    if (!this.skills.has(skillId)) return false;
    this.enabledSkills.delete(skillId);
    this.skills.get(skillId).isEnabled = false;
    return true;
  }

  isSkillEnabled(skillId) {
    return this.enabledSkills.has(skillId);
  }

  /**
   * Executes an action within a registered skill
   */
  async executeSkillAction(skillId, actionName, params = {}, context = {}) {
    if (!this.isSkillEnabled(skillId)) {
      throw new Error(`Skill '${skillId}' is currently disabled.`);
    }

    const toolName = `${skillId}.${actionName}`;
    return await toolRegistry.executeTool(toolName, params, context);
  }
}

module.exports = {
  SkillRegistry,
  skillRegistry: new SkillRegistry()
};
