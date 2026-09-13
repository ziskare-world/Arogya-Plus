function validateInput(action, args) {
  if (action === "manage_task" && !args.title) return { valid: false, error: "title is required" };
  return { valid: true };
}

module.exports = { validateInput };
