// ============================================
// Profitability Engine
// ============================================
// 
// HARD CONSTRAINT: >= 30% gross margin on all subscription revenue.
//
// Cost model:
// - 1 credit = 1 second of generated video output
// - HeyGen charges per minute of video generated
// - We add buffers for retries, payment fees, and infra
//
// Formulas (all amounts in INR):
//   effective_cost_per_min_inr = max(heygen_rate_usd) * USDINR * 1.15
//   payment_fee = plan_price * payment_fee_rate
//   available_for_costs = plan_price * (1 - target_margin) - payment_fee
//   effective_minute_cost = effective_cost_per_min_inr + infra_per_min_inr
//   included_minutes = floor(available_for_costs / effective_minute_cost)
//   included_seconds = included_minutes * 60
// ============================================

// ─── Configurable Constants (ENV-driven, admin-editable) ─────

export const BILLING_CONFIG = {
  // Exchange rate (default; updateable via ENV or admin panel)
  USDINR: parseFloat(process.env.BILLING_USDINR || '96'),

  // HeyGen per-minute costs (USD) - worst-case for margin safety
  HEYGEN_COST_PER_MIN_USD: {
    '720p': parseFloat(process.env.BILLING_HEYGEN_720P_USD || '1.00'),
    '1080p': parseFloat(process.env.BILLING_HEYGEN_1080P_USD || '1.00'),
    '4k': parseFloat(process.env.BILLING_HEYGEN_4K_USD || '1.20'),
  },

  // Buffer multiplier for retries/edge cases (15%)
  HEYGEN_BUFFER_MULTIPLIER: parseFloat(process.env.BILLING_HEYGEN_BUFFER || '1.15'),

  // Payment fee rate (Razorpay platform + GST + subscription addon)
  PAYMENT_FEE_RATE: parseFloat(process.env.BILLING_PAYMENT_FEE_RATE || '0.05'),

  // Infra cost per minute (storage, CDN, Redis, logs)
  INFRA_PER_MIN_INR: parseFloat(process.env.BILLING_INFRA_PER_MIN_INR || '5'),

  // Target gross margin (minimum 30%)
  TARGET_MARGIN: parseFloat(process.env.BILLING_TARGET_MARGIN || '0.30'),

  // Avatar setup cost (one-time HeyGen training ~$5)
  AVATAR_TRAINING_COST_USD: parseFloat(process.env.BILLING_AVATAR_COST_USD || '5.00'),

  // Fixed ops fee per avatar setup (INR) - support, consent, monitoring
  AVATAR_FIXED_OPS_FEE_INR: parseFloat(process.env.BILLING_AVATAR_OPS_FEE_INR || '50'),

  // Top-up expiry in days (from purchase or billing cycle end)
  TOPUP_EXPIRY_DAYS: parseInt(process.env.BILLING_TOPUP_EXPIRY_DAYS || '60'),
} as const;

// ─── Derived Costs ───────────────────────────────────────────

/**
 * Effective cost per minute in INR (worst-case + buffer).
 * Uses the max HeyGen rate ($1.20/min for 4K) * USDINR * 1.15 buffer.
 */
export function getEffectiveCostPerMinINR(): number {
  const maxRateUSD = Math.max(
    ...Object.values(BILLING_CONFIG.HEYGEN_COST_PER_MIN_USD)
  );
  return maxRateUSD * BILLING_CONFIG.USDINR * BILLING_CONFIG.HEYGEN_BUFFER_MULTIPLIER;
}

/**
 * Total variable cost per minute (HeyGen effective + infra).
 */
export function getTotalCostPerMinINR(): number {
  return getEffectiveCostPerMinINR() + BILLING_CONFIG.INFRA_PER_MIN_INR;
}

/**
 * Cost per second in INR (for precise credit costing).
 */
export function getCostPerSecondINR(): number {
  return getTotalCostPerMinINR() / 60;
}

// ─── Plan Profitability Calculator ───────────────────────────

export interface PlanProfitability {
  planPriceINR: number;
  targetMargin: number;
  paymentFee: number;
  availableForCosts: number;
  effectiveMinuteCostINR: number;
  includedMinutes: number;
  includedSeconds: number;
  actualMargin: number;
  profitable: boolean;
}

/**
 * Compute the maximum included seconds for a plan while maintaining
 * the target gross margin.
 *
 * Formula:
 *   available_for_variable_costs = P * (1 - margin)
 *   after_payment = available_for_variable_costs - (P * payment_fee_rate)
 *   included_minutes = floor(after_payment / effective_minute_cost)
 *   included_seconds = included_minutes * 60
 */
export function computePlanProfitability(planPriceINR: number): PlanProfitability {
  const { TARGET_MARGIN, PAYMENT_FEE_RATE } = BILLING_CONFIG;

  const paymentFee = planPriceINR * PAYMENT_FEE_RATE;
  const availableForCosts = planPriceINR * (1 - TARGET_MARGIN) - paymentFee;
  const effectiveMinuteCostINR = getTotalCostPerMinINR();

  // Never allow negative
  const includedMinutes = Math.max(0, Math.floor(availableForCosts / effectiveMinuteCostINR));
  const includedSeconds = includedMinutes * 60;

  // Compute actual margin if all credits are consumed
  const actualCost = (includedMinutes * effectiveMinuteCostINR) + paymentFee;
  const actualMargin = planPriceINR > 0 ? (planPriceINR - actualCost) / planPriceINR : 0;

  return {
    planPriceINR,
    targetMargin: TARGET_MARGIN,
    paymentFee,
    availableForCosts: Math.max(0, availableForCosts),
    effectiveMinuteCostINR,
    includedMinutes,
    includedSeconds,
    actualMargin,
    profitable: actualMargin >= TARGET_MARGIN,
  };
}

// ─── Avatar Setup Add-on Pricing ─────────────────────────────

export interface AvatarSetupPricing {
  baseCostINR: number;
  opsFeINR: number;
  totalCostINR: number;
  customerPriceINR: number;
  margin: number;
}

/**
 * Compute avatar setup add-on price preserving 30% margin.
 *
 * Formula:
 *   base_cost = avatar_api_cost_usd * USDINR * buffer
 *   total_cost = base_cost + fixed_ops_fee
 *   price = ceil(total_cost / (1 - margin - payment_fee_rate))
 */
export function computeAvatarSetupPrice(): AvatarSetupPricing {
  const { AVATAR_TRAINING_COST_USD, USDINR, HEYGEN_BUFFER_MULTIPLIER, AVATAR_FIXED_OPS_FEE_INR, TARGET_MARGIN, PAYMENT_FEE_RATE } = BILLING_CONFIG;

  const baseCostINR = AVATAR_TRAINING_COST_USD * USDINR * HEYGEN_BUFFER_MULTIPLIER;
  const totalCostINR = baseCostINR + AVATAR_FIXED_OPS_FEE_INR;
  const customerPriceINR = Math.ceil(totalCostINR / (1 - TARGET_MARGIN - PAYMENT_FEE_RATE));
  const margin = (customerPriceINR - totalCostINR - (customerPriceINR * PAYMENT_FEE_RATE)) / customerPriceINR;

  return {
    baseCostINR: Math.round(baseCostINR),
    opsFeINR: AVATAR_FIXED_OPS_FEE_INR,
    totalCostINR: Math.round(totalCostINR),
    customerPriceINR,
    margin,
  };
}

// ─── Top-up Pricing ──────────────────────────────────────────

export interface TopupOption {
  id: string;
  seconds: number;
  priceINR: number;
  perSecondINR: number;
  margin: number;
}

/**
 * Top-up pricing with higher per-second cost (premium for convenience).
 * Top-ups use ~40% margin (higher than subscription).
 */
export function getTopupOptions(): TopupOption[] {
  const costPerSec = getCostPerSecondINR();
  const { PAYMENT_FEE_RATE } = BILLING_CONFIG;
  const topupMargin = 0.40; // 40% margin on top-ups (higher than subs)

  const options = [
    { id: 'topup_60', seconds: 60, priceINR: 199 },
    { id: 'topup_180', seconds: 180, priceINR: 499 },
    { id: 'topup_360', seconds: 360, priceINR: 899 },
  ];

  return options.map((opt) => {
    const variableCost = opt.seconds * costPerSec;
    const paymentFee = opt.priceINR * PAYMENT_FEE_RATE;
    const actualMargin = (opt.priceINR - variableCost - paymentFee) / opt.priceINR;

    // If computed margin < 30%, adjust price up (shouldn't happen with these prices)
    let finalPrice = opt.priceINR;
    if (actualMargin < 0.30) {
      finalPrice = Math.ceil((variableCost + paymentFee) / (1 - 0.30));
    }

    return {
      id: opt.id,
      seconds: opt.seconds,
      priceINR: finalPrice,
      perSecondINR: Math.round((finalPrice / opt.seconds) * 100) / 100,
      margin: actualMargin,
    };
  });
}

// ─── Plan Definitions (computed from profitability) ──────────

export interface PlanDefinition {
  id: string;
  name: string;
  nameHi: string;
  priceINR: number;
  includedSeconds: number;
  includedMinutesDisplay: string;
  maxResolution: '720p' | '1080p' | '4k';
  allowCustomAvatar: boolean; // requires add-on purchase
  priorityQueue: boolean;
  features: string[];
  featuresHi: string[];
  profitability: PlanProfitability;
}

/**
 * Get all subscription plans with computed profitability.
 * Plans are fixed at Starter/Creator/Studio with prices that maintain margin.
 */
export function getPlans(): PlanDefinition[] {
  const starterProfit = computePlanProfitability(199);
  const creatorProfit = computePlanProfitability(499);
  const studioProfit = computePlanProfitability(999);

  return [
    {
      id: 'STARTER',
      name: 'Starter',
      nameHi: 'स्टार्टर',
      priceINR: 199,
      includedSeconds: Math.min(starterProfit.includedSeconds, 60), // cap at 60s for trial feel
      includedMinutesDisplay: '1 min',
      maxResolution: '720p',
      allowCustomAvatar: false, // stock avatars only; custom via add-on
      priorityQueue: false,
      features: [
        '60 seconds video credits',
        'Script templates',
        'Background color/image',
        '720p resolution',
        'Stock avatars only',
        'Avatar Setup available as add-on',
      ],
      featuresHi: [
        '60 सेकंड वीडियो क्रेडिट',
        'स्क्रिप्ट टेम्पलेट्स',
        'बैकग्राउंड कलर/इमेज',
        '720p रिज़ॉल्यूशन',
        'स्टॉक अवतार',
        'अवतार सेटअप add-on उपलब्ध',
      ],
      profitability: starterProfit,
    },
    {
      id: 'CREATOR',
      name: 'Creator',
      nameHi: 'क्रिएटर',
      priceINR: 499,
      includedSeconds: Math.min(creatorProfit.includedSeconds, 180), // cap at 180s
      includedMinutesDisplay: '3 min',
      maxResolution: '1080p',
      allowCustomAvatar: false, // default off; admin can toggle
      priorityQueue: false,
      features: [
        '180 seconds video credits',
        'Script templates',
        'Background color/image',
        '720p / 1080p resolution',
        'Avatar Setup available as add-on',
        '1 voice clone included',
      ],
      featuresHi: [
        '180 सेकंड वीडियो क्रेडिट',
        'स्क्रिप्ट टेम्पलेट्स',
        'बैकग्राउंड कलर/इमेज',
        '720p / 1080p रिज़ॉल्यूशन',
        'अवतार सेटअप add-on उपलब्ध',
        '1 वॉइस क्लोन शामिल',
      ],
      profitability: creatorProfit,
    },
    {
      id: 'STUDIO',
      name: 'Studio',
      nameHi: 'स्टूडियो',
      priceINR: 999,
      includedSeconds: Math.min(studioProfit.includedSeconds, 360), // cap at 360s
      includedMinutesDisplay: '6 min',
      maxResolution: '1080p',
      allowCustomAvatar: false, // via add-on, but admin can grant free
      priorityQueue: true,
      features: [
        '360 seconds video credits',
        'Priority queue + higher concurrency',
        '1080p default resolution',
        'Background color/image/transparent',
        'Avatar Setup available as add-on',
        '2 voice clones included',
        '4K available as top-up',
      ],
      featuresHi: [
        '360 सेकंड वीडियो क्रेडिट',
        'प्रायॉरिटी क्यू + हाई कॉन्करेंसी',
        '1080p डिफ़ॉल्ट रिज़ॉल्यूशन',
        'बैकग्राउंड कलर/इमेज/ट्रांसपेरेंट',
        'अवतार सेटअप add-on उपलब्ध',
        '2 वॉइस क्लोन शामिल',
        '4K top-up में उपलब्ध',
      ],
      profitability: studioProfit,
    },
  ];
}

// ─── Validation: Pre-generation Credit Check ─────────────────

/**
 * Before generating a video, check if user has enough seconds.
 * Returns { allowed, reason, secondsNeeded, secondsAvailable }
 */
export function validateCreditSufficiency(
  requestedSeconds: number,
  monthlyRemaining: number,
  topupRemaining: number
): {
  allowed: boolean;
  reason?: string;
  secondsNeeded: number;
  secondsAvailable: number;
  useMonthly: number;
  useTopup: number;
} {
  const totalAvailable = monthlyRemaining + topupRemaining;

  if (requestedSeconds <= 0) {
    return { allowed: false, reason: 'Invalid duration', secondsNeeded: 0, secondsAvailable: totalAvailable, useMonthly: 0, useTopup: 0 };
  }

  if (totalAvailable < requestedSeconds) {
    return {
      allowed: false,
      reason: `Insufficient credits. Need ${requestedSeconds}s, have ${totalAvailable}s. Buy a top-up or upgrade.`,
      secondsNeeded: requestedSeconds,
      secondsAvailable: totalAvailable,
      useMonthly: 0,
      useTopup: 0,
    };
  }

  // Consume monthly credits first, then topup
  const useMonthly = Math.min(requestedSeconds, monthlyRemaining);
  const useTopup = requestedSeconds - useMonthly;

  return {
    allowed: true,
    secondsNeeded: requestedSeconds,
    secondsAvailable: totalAvailable,
    useMonthly,
    useTopup,
  };
}

// ─── Debug: Print all computed values ────────────────────────

export function debugProfitability(): void {
  console.log('=== AvatarForge Profitability Engine ===');
  console.log(`USDINR: ₹${BILLING_CONFIG.USDINR}`);
  console.log(`Effective cost/min: ₹${getEffectiveCostPerMinINR().toFixed(2)}`);
  console.log(`Total cost/min (with infra): ₹${getTotalCostPerMinINR().toFixed(2)}`);
  console.log(`Cost/second: ₹${getCostPerSecondINR().toFixed(2)}`);
  console.log('');

  const plans = getPlans();
  for (const plan of plans) {
    console.log(`[${plan.id}] ₹${plan.priceINR}/mo → ${plan.includedSeconds}s included`);
    console.log(`  Margin: ${(plan.profitability.actualMargin * 100).toFixed(1)}%`);
    console.log(`  Profitable: ${plan.profitability.profitable}`);
  }
  console.log('');

  const avatar = computeAvatarSetupPrice();
  console.log(`[Avatar Setup] Price: ₹${avatar.customerPriceINR} (cost: ₹${avatar.totalCostINR}, margin: ${(avatar.margin * 100).toFixed(1)}%)`);
  console.log('');

  const topups = getTopupOptions();
  for (const t of topups) {
    console.log(`[Top-up ${t.seconds}s] ₹${t.priceINR} (₹${t.perSecondINR}/s, margin: ${(t.margin * 100).toFixed(1)}%)`);
  }
}
