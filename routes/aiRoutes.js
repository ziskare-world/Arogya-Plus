const express = require("express");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateMiddleware");
const { buildSymptomAssessment } = require("../utils/symptomChecker");

const router = express.Router();

router.post(
  "/symptom-checker",
  [
    body("symptoms").isArray({ min: 1 }).withMessage("symptoms must be a non-empty array"),
    body("symptoms.*").isString().withMessage("Each symptom must be a string"),
    body("age").optional().isInt({ min: 0, max: 120 }).withMessage("Age must be between 0 and 120")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const assessment = buildSymptomAssessment({
      symptoms: req.body.symptoms,
      age: req.body.age || 30
    });

    return res.status(200).json({
      success: true,
      message: "AI symptom assessment completed",
      assessment,
      disclaimer:
        "This tool is informational and not a substitute for professional medical diagnosis."
    });
  })
);

module.exports = router;
