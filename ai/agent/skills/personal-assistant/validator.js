function validateInput(action, args) {
  if (action === "create_reminder" && !args.reminder) return { valid: false, error: "reminder text is required" };
  if (action === "add_note" && !args.note) return { valid: false, error: "note text is required" };
  return { valid: true };
}

module.exports = { validateInput };
