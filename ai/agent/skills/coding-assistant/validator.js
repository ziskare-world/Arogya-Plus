function validateInput(action, args) {
  if (!args.code) return { valid: false, error: "code snippet is required" };
  return { valid: true };
}

module.exports = { validateInput };
