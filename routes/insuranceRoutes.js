const express = require("express");
const asyncHandler = require("express-async-handler");
const { body, param } = require("express-validator");
const Insurance = require("../models/Insurance");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");

const router = express.Router();

router.post(
  "/claims",
  protect,
  authorize("patient", "admin"),
  [
    body("providerName").trim().notEmpty().withMessage("Provider name is required"),
    body("policyNumber").trim().notEmpty().withMessage("Policy number is required"),
    body("claimAmount").isFloat({ gt: 0 }).withMessage("Claim amount must be greater than zero"),
    body("claimReason").trim().notEmpty().withMessage("Claim reason is required"),
    body("documents").optional().isArray().withMessage("Documents must be an array")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const claim = await Insurance.create({
      user: req.user._id,
      providerName: req.body.providerName,
      policyNumber: req.body.policyNumber,
      claimAmount: req.body.claimAmount,
      claimReason: req.body.claimReason,
      documents: req.body.documents || []
    });

    return res.status(201).json({
      success: true,
      message: "Insurance claim submitted",
      claim
    });
  })
);

router.get(
  "/my",
  protect,
  asyncHandler(async (req, res) => {
    const claims = await Insurance.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, claims });
  })
);

router.get(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const claims = await Insurance.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, claims });
  })
);

router.patch(
  "/:id/review",
  protect,
  authorize("admin"),
  [
    param("id").isMongoId().withMessage("Valid claim id is required"),
    body("status")
      .isIn(["under_review", "approved", "rejected"])
      .withMessage("Invalid claim status"),
    body("adminRemark").optional().isString().withMessage("adminRemark must be a string")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const claim = await Insurance.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Insurance claim not found" });
    }

    claim.status = req.body.status;
    claim.adminRemark = req.body.adminRemark || claim.adminRemark;
    await claim.save();

    return res.status(200).json({
      success: true,
      message: "Claim review updated",
      claim
    });
  })
);

module.exports = router;
