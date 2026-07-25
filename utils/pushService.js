let webpush = null;
try {
  webpush = require("web-push");
} catch {
  webpush = null;
}
const PushSubscription = require("../models/PushSubscription");

const getVapidConfig = () => {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "mailto:admin@arogyaplus.com").trim();

  return { publicKey, privateKey, subject };
};

let isConfigured = false;

const ensureConfigured = () => {
  if (isConfigured) return true;
  if (!webpush) return false;

  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
};

const isPushConfigured = () => ensureConfigured();

const getPublicVapidKey = () => {
  const { publicKey } = getVapidConfig();
  return publicKey;
};

const markSubscriptionInactive = async (endpoint) => {
  if (!endpoint) return;
  await PushSubscription.updateOne({ endpoint }, { $set: { isActive: false } });
};

const sendPushToStoredSubscription = async (subscriptionDoc, payload) => {
  if (!ensureConfigured()) {
    throw new Error("Push notification is not configured on server");
  }

  const subscription = {
    endpoint: subscriptionDoc.endpoint,
    expirationTime: subscriptionDoc.expirationTime || null,
    keys: {
      p256dh: subscriptionDoc.keys?.p256dh || "",
      auth: subscriptionDoc.keys?.auth || ""
    }
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 120
    });

    await PushSubscription.updateOne(
      { _id: subscriptionDoc._id },
      { $set: { lastUsedAt: new Date(), isActive: true } }
    );
    return { ok: true };
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await markSubscriptionInactive(subscriptionDoc.endpoint);
    }
    return {
      ok: false,
      statusCode: error?.statusCode || 500,
      message: error?.message || "Failed to send push notification"
    };
  }
};

const notifyUsers = async (userIds = [], payload = {}) => {
  const ids = userIds
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (!ids.length) return { successCount: 0, failureCount: 0 };
  if (!ensureConfigured()) {
    throw new Error("Push notification is not configured on server");
  }

  const subscriptions = await PushSubscription.find({
    user: { $in: ids },
    isActive: true
  });

  let successCount = 0;
  let failureCount = 0;

  for (const sub of subscriptions) {
    const result = await sendPushToStoredSubscription(sub, payload);
    if (result.ok) successCount += 1;
    else failureCount += 1;
  }

  return { successCount, failureCount, total: subscriptions.length };
};

const notifyUser = async (userId, payload = {}) => {
  return notifyUsers([userId], payload);
};

module.exports = {
  isPushConfigured,
  getPublicVapidKey,
  sendPushToStoredSubscription,
  notifyUsers,
  notifyUser
};
