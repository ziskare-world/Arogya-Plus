const express = require("express");
const path = require("path");

const router = express.Router();
const uiDirectory = path.join(__dirname, "..", "ui");

router.get("/login", (req, res) => {
  res.sendFile(path.join(uiDirectory , "login.html"));
});

router.get("/login.html", (req, res) => {
  res.sendFile(path.join(uiDirectory, "backend-js", "login.html"));
});

router.get("/register", (req, res) => {
  res.sendFile(path.join(uiDirectory, "backend-js", "register.html"));
});

router.get("/register.html", (req, res) => {
  res.sendFile(path.join(uiDirectory, "backend-js", "register.html"));
});

module.exports = router;
