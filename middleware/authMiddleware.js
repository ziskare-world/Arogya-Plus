const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Authorization token missing");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(401);
    throw new Error("Invalid or expired token");
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    res.status(401);
    throw new Error("User not found");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("User account is inactive");
  }

  req.user = user;
  next();
});

const authorize = (...roles) => {
  return (req, res, next) => {
    const normalizeRole = (roleValue = "") =>
      String(roleValue)
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");

    const allowedRoles = roles.map(normalizeRole);
    const userRole = normalizeRole(req.user?.role);

    if (!req.user || !allowedRoles.includes(userRole)) {
      res.status(403);
      throw new Error("You are not authorized to access this resource");
    }
    next();
  };
};

module.exports = { protect, authorize };
