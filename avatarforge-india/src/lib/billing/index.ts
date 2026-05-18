// ============================================
// Billing Module - Public Exports
// ============================================

export {
  BILLING_CONFIG,
  getEffectiveCostPerMinINR,
  getTotalCostPerMinINR,
  getCostPerSecondINR,
  computePlanProfitability,
  computeAvatarSetupPrice,
  getTopupOptions,
  getPlans,
  validateCreditSufficiency,
  debugProfitability,
} from './profitability';

export type {
  PlanProfitability,
  AvatarSetupPricing,
  TopupOption,
  PlanDefinition,
} from './profitability';

export {
  getRazorpay,
  getRazorpayPlanId,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay';

export { handleRazorpayWebhook } from './webhook-handler';
export type { WebhookResult } from './webhook-handler';

export {
  getWallet,
  checkSufficientCredits,
  deductCredits,
  refundCredits,
  isSubscriptionActive,
} from './credits';

export type { DeductionResult, WalletSnapshot } from './credits';
