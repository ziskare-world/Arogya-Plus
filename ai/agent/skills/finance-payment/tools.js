const Payment = require("../../../../models/Payment");

const tools = [
  {
    name: "finance-payment.get_payment_status",
    description: "Looks up authorized payment status for a user",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string" }
      }
    },
    permissionLevel: "READ_ONLY",
    keywords: ["payment status", "check bill", "transaction status"],
    execute: async (args, context = {}) => {
      const userId = context.user?._id || context.user?.id;
      if (!userId) return { error: "Authentication required to view billing." };

      const payments = await Payment.find({ user: userId }).sort({ createdAt: -1 }).limit(5).lean();
      return {
        payments: payments.map(p => ({
          id: p._id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          date: p.createdAt
        }))
      };
    }
  },
  {
    name: "finance-payment.explain_billing",
    description: "Explains Razorpay payment workflows and refund guidelines",
    inputSchema: { type: "object", properties: {} },
    permissionLevel: "READ_ONLY",
    keywords: ["how to pay", "refund policy", "billing inquiry"],
    execute: async () => {
      return {
        methodsAccepted: ["UPI", "Credit/Debit Cards", "Net Banking", "Razorpay QR Pass"],
        refundTimeline: "Refunds are processed within 5-7 banking business days.",
        securityCompliance: "All transactions are 256-bit encrypted. ArogyaPlus never stores card or CVV details."
      };
    }
  }
];

module.exports = { tools };
