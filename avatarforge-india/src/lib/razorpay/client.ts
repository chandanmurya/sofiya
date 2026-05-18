// ============================================
// Razorpay Payment Client
// ============================================

import Razorpay from 'razorpay';
import { PlanConfig } from '@/types';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export { razorpay };

// ─── Plan Configurations ─────────────────────────────────────

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    nameHi: 'मुफ्त',
    priceInr: 0,
    razorpayPlanId: '',
    credits: 50,
    maxAvatars: 1,
    maxVoices: 1,
    maxResolution: 'HD_720P',
    maxVideoDurationSec: 60,
    features: [
      '1 Avatar',
      '1 Voice Clone',
      '50 credits/month',
      '720p max resolution',
      '60 sec max video',
      'Watermark on videos',
    ],
    featuresHi: [
      '1 अवतार',
      '1 वॉइस क्लोन',
      '50 क्रेडिट/महीना',
      '720p max resolution',
      '60 sec max video',
      'वीडियो पर वॉटरमार्क',
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    nameHi: 'स्टार्टर',
    priceInr: 999,
    razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID || '',
    credits: 200,
    maxAvatars: 2,
    maxVoices: 2,
    maxResolution: 'HD_720P',
    maxVideoDurationSec: 180,
    features: [
      '2 Avatars',
      '2 Voice Clones',
      '200 credits/month',
      '720p resolution',
      '3 min max video',
      'No watermark',
      'Priority support',
    ],
    featuresHi: [
      '2 अवतार',
      '2 वॉइस क्लोन',
      '200 क्रेडिट/महीना',
      '720p resolution',
      '3 min max video',
      'वॉटरमार्क नहीं',
      'Priority support',
    ],
  },
  CREATOR: {
    id: 'CREATOR',
    name: 'Creator',
    nameHi: 'क्रिएटर',
    priceInr: 2499,
    razorpayPlanId: process.env.RAZORPAY_CREATOR_PLAN_ID || '',
    credits: 600,
    maxAvatars: 5,
    maxVoices: 5,
    maxResolution: 'FHD_1080P',
    maxVideoDurationSec: 600,
    features: [
      '5 Avatars',
      '5 Voice Clones',
      '600 credits/month',
      '1080p resolution',
      '10 min max video',
      'No watermark',
      'Transparent BG export',
      'Priority queue',
      'Email support',
    ],
    featuresHi: [
      '5 अवतार',
      '5 वॉइस क्लोन',
      '600 क्रेडिट/महीना',
      '1080p resolution',
      '10 min max video',
      'वॉटरमार्क नहीं',
      'Transparent BG export',
      'Priority queue',
      'Email support',
    ],
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency',
    nameHi: 'एजेंसी',
    priceInr: 7999,
    razorpayPlanId: process.env.RAZORPAY_AGENCY_PLAN_ID || '',
    credits: 2500,
    maxAvatars: 20,
    maxVoices: 20,
    maxResolution: 'FHD_1080P',
    maxVideoDurationSec: 1800,
    features: [
      '20 Avatars',
      '20 Voice Clones',
      '2500 credits/month',
      '1080p resolution',
      '30 min max video',
      'No watermark',
      'Transparent BG export',
      'Priority queue',
      'API access',
      'Dedicated support',
      'Custom branding',
    ],
    featuresHi: [
      '20 अवतार',
      '20 वॉइस क्लोन',
      '2500 क्रेडिट/महीना',
      '1080p resolution',
      '30 min max video',
      'वॉटरमार्क नहीं',
      'Transparent BG export',
      'Priority queue',
      'API access',
      'Dedicated support',
      'Custom branding',
    ],
  },
};

// ─── Razorpay Helpers ────────────────────────────────────────

export async function createSubscription(params: {
  planId: string;
  customerId?: string;
  customerEmail: string;
  customerPhone?: string;
  totalBillingCycles?: number;
}): Promise<any> {
  const subscription = await razorpay.subscriptions.create({
    plan_id: params.planId,
    total_count: params.totalBillingCycles || 12,
    customer_notify: 1,
    notes: {
      customer_email: params.customerEmail,
    },
  });

  return subscription;
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtEnd = true
): Promise<any> {
  return razorpay.subscriptions.cancel(subscriptionId, cancelAtEnd);
}

export async function getSubscriptionDetails(subscriptionId: string) {
  return razorpay.subscriptions.fetch(subscriptionId);
}
