const express = require("express");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateMiddleware");
const PushSubscription = require("../models/PushSubscription");
const {
  isPushConfigured,
  getPublicVapidKey,
  sendPushToStoredSubscription,
  notifyUser
} = require("../utils/pushService");

const router = express.Router();

router.get(
  "/vapid-public-key",
  protect,
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Push notifications are not configured on server"
      });
    }

    return res.status(200).json({
      success: true,
      publicKey: getPublicVapidKey()
    });
  })
);

router.post(
  "/subscribe",
  protect,
  [
    body("subscription").isObject().withMessage("subscription object is required"),
    body("subscription.endpoint").isString().notEmpty().withMessage("subscription.endpoint is required"),
    body("subscription.keys").isObject().withMessage("subscription.keys is required"),
    body("subscription.keys.p256dh")
      .isString()
      .notEmpty()
      .withMessage("subscription.keys.p256dh is required"),
    body("subscription.keys.auth")
      .isString()
      .notEmpty()
      .withMessage("subscription.keys.auth is required")
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Push notifications are not configured on server"
      });
    }

    const subscription = req.body.subscription || {};
    const endpoint = String(subscription.endpoint || "").trim();

    const update = {
      user: req.user._id,
      endpoint,
      keys: {
        p256dh: String(subscription.keys?.p256dh || "").trim(),
        auth: String(subscription.keys?.auth || "").trim()
      },
      expirationTime:
        subscription.expirationTime === null || subscription.expirationTime === undefined
          ? null
          : Number(subscription.expirationTime),
      userAgent: String(req.headers["user-agent"] || "").trim(),
      isActive: true
    };

    await PushSubscription.findOneAndUpdate({ endpoint }, { $set: update }, { upsert: true, new: true });

    return res.status(200).json({
      success: true,
      message: "Push subscription saved"
    });
  })
);

router.post(
  "/unsubscribe",
  protect,
  [body("endpoint").isString().notEmpty().withMessage("endpoint is required")],
  validateRequest,
  asyncHandler(async (req, res) => {
    const endpoint = String(req.body.endpoint || "").trim();
    await PushSubscription.updateMany(
      { endpoint, user: req.user._id },
      { $set: { isActive: false } }
    );

    return res.status(200).json({
      success: true,
      message: "Push subscription removed"
    });
  })
);

router.post(
  "/test",
  protect,
  [
    body("title").optional().isString(),
    body("body").optional().isString(),
    body("url").optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Push notifications are not configured on server"
      });
    }

    const payload = {
      title: String(req.body.title || "Arogya Plus"),
      body: String(req.body.body || "This is a test mobile notification."),
      url: String(req.body.url || "/user/dashboard"),
      tag: "arogya-test"
    };

    const subscriptions = await PushSubscription.find({
      user: req.user._id,
      isActive: true
    });

    let successCount = 0;
    let failureCount = 0;
    for (const sub of subscriptions) {
      const result = await sendPushToStoredSubscription(sub, payload);
      if (result.ok) successCount += 1;
      else failureCount += 1;
    }

    return res.status(200).json({
      success: true,
      message: "Test notification request processed",
      deliveries: {
        success: successCount,
        failed: failureCount,
        totalSubscriptions: subscriptions.length
      }
    });
  })
);

router.post(
  "/send",
  protect,
  authorize("admin", "super-admin"),
  [
    body("userId").isMongoId().withMessage("userId is required"),
    body("title").optional().isString(),
    body("body").optional().isString(),
    body("url").optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Push notifications are not configured on server"
      });
    }

    const payload = {
      title: String(req.body.title || "Arogya Plus Alert"),
      body: String(req.body.body || "You have a new update."),
      url: String(req.body.url || "/user/dashboard"),
      tag: "arogya-admin"
    };

    const result = await notifyUser(req.body.userId, payload);

    return res.status(200).json({
      success: true,
      message: "Notification send request processed",
      deliveries: result
    });
  })
);

module.exports = router;
