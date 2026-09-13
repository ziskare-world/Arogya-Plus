function validateInput(action, args) {
  if (action === "delegate_to_subagent" && (!args.agentId || !args.task)) {
    return { valid: false, error: "agentId and task are required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
