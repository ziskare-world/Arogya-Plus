function validateInput(action, args) {
  if (action === "geocode_address" && !args.address) return { valid: false, error: "address is required" };
  if (action === "calculate_route_eta" && (!args.origin || !args.destination)) {
    return { valid: false, error: "origin and destination are required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
