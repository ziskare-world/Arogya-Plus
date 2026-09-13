function validateInput(action, args) {
  if (action === "chat" && (!args.message || typeof args.message !== "string")) {
    return { valid: false, error: "message string is required" };
  }
  if (action === "summarize" && (!args.text || typeof args.text !== "string")) {
    return { valid: false, error: "text string is required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
