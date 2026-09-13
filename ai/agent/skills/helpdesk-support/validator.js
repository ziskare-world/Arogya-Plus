function validateInput(action, args) {
  if (action === "create_ticket") {
    if (!args.title || !args.description) {
      return { valid: false, error: "title and description are required" };
    }
  }
  return { valid: true };
}

module.exports = { validateInput };
