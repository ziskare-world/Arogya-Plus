function validateInput(action, args) {
  if (action === "create_workflow") {
    if (!args.name || !Array.isArray(args.steps)) {
      return { valid: false, error: "name and steps array are required" };
    }
  }
  return { valid: true };
}

module.exports = { validateInput };
