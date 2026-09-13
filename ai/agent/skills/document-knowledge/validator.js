function validateInput(action, args) {
  if (action === "ingest_document" && (!args.title || !args.content)) {
    return { valid: false, error: "title and content are required" };
  }
  if (action === "search_knowledge" && !args.query) {
    return { valid: false, error: "query is required" };
  }
  return { valid: true };
}

module.exports = { validateInput };
