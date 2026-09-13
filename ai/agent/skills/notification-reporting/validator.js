function validateInput(action, args) {
  if (action === "send_notification_alert" && (!args.title || !args.message)) {
    return { valid: false, error: "title and message are required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
