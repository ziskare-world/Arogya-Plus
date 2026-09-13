const manifest = require("./manifest.json");
const { tools } = require("./tools");
const { validateInput } = require("./validator");

module.exports = {
  ...manifest,
  tools,
  validator: validateInput
};
