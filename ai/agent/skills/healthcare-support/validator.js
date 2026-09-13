function validateInput(action, args) {
  if (action === "triage_symptoms" && (!args.symptoms || !Array.isArray(args.symptoms))) {
    return { valid: false, error: "symptoms array is required" };
  }
  if (action === "book_appointment" && !args.prompt) {
    return { valid: false, error: "prompt is required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
