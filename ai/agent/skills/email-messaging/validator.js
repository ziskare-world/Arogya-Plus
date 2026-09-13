function validateInput(action, args) {
  if (action === "draft_email" || action === "send_email") {
    if (!args.to || !args.subject) return { valid: false, error: "to and subject are required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
