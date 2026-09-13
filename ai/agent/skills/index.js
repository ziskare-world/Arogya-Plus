/**
 * 📦 Arogy AI Agent - Skills Auto-Loader
 * Automatically imports and registers all 15 skills into the SkillRegistry.
 */

const { skillRegistry } = require("../core/skillRegistry");

const SKILL_MODULES = [
  require("./general-chatbot"),
  require("./helpdesk-support"),
  require("./personal-assistant"),
  require("./automation-engine"),
  require("./email-messaging"),
  require("./document-knowledge"),
  require("./project-management"),
  require("./coding-assistant"),
  require("./database-assistant"),
  require("./notification-reporting"),
  require("./web-api-integration"),
  require("./finance-payment"),
  require("./healthcare-support"),
  require("./system-monitoring"),
  require("./multi-agent-coordination")
];

function initializeSkills() {
  for (const skill of SKILL_MODULES) {
    skillRegistry.registerSkill(skill);
  }
}

// Auto-initialize when loaded
initializeSkills();

module.exports = {
  initializeSkills,
  SKILL_MODULES
};
