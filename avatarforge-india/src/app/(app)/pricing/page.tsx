'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Plan data matching profitability engine output
const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    nameHi: 'स्टार्टर',
    price: 199,
    seconds: 60,
    display: '1 min',
    resolution: '720p',
    popular: false,
    features: [
      '60 seconds video credits/month',
      'Script templates',
      'Background color/image',
      '720p resolution',
      'Stock avatars only',
      'Avatar Setup add-on available (₹849)',
    ],
  },
  {
    id: 'CREATOR',
    name: 'Creator',
    nameHi: 'क्रिएटर',
    price: 499,
    seconds: 180,
    display: '3 min',
    resolution: '1080p',
    popular: true,
    features: [
      '180 seconds video credits/month',
      'Script templates',
      'Background color/image',
      '720p + 1080p resolution',
      'Avatar Setup add-on available',
      '1 voice clone included',
      'Top-ups available',
    ],
  },
  {
    id: 'STUDIO',
    name: 'Studio',
    nameHi: 'स्टूडियो',
    price: 999,
    seconds: 360,
    display: '6 min',
    resolution: '1080p',
    popular: false,
    features: [
      '360 seconds video credits/month',
      'Priority queue + higher concurrency',
      '1080p default resolution',
      'Transparent background (WEBM)',
      'Avatar Setup add-on available',
      '2 voice clones included',
      '4K available via top-up',
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [subscribing, setSubscribing] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setSubscribing(planId);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: planId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      // Redirect to Razorpay hosted page
      if (data.data?.shortUrl) {
        window.location.href = data.data.shortUrl;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <div className="page-container max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Simple, Transparent Pricing
        </h1>
        <p className="text-dark-100 text-lg">
          Start creating AI videos in minutes. No hidden fees.
        </p>
        <p className="text-sm text-dark-200 mt-2">
          1 credit = 1 second of video output • All prices in INR
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`glass-card p-6 relative flex flex-col ${
              plan.popular ? 'ring-2 ring-brand-500/60 scale-[1.02]' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-brand-600 text-white text-xs font-medium px-4 py-1 rounded-full shadow-lg shadow-brand-600/30">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="text-xs text-dark-200 mt-0.5">{plan.nameHi}</p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">₹{plan.price}</span>
                <span className="text-dark-200 text-sm">/month</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 bg-brand-500/10 border border-brand-500/30 rounded text-xs text-brand-400 font-medium">
                  {plan.display} included
                </span>
                <span className="text-xs text-dark-300">({plan.seconds}s)</span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2.5 mb-8 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-dark-100">
                  <span className="text-green-400 mt-0.5 text-xs">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={!!subscribing}
              className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
                plan.popular
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {subscribing === plan.id ? 'Processing...' : `Subscribe — ₹${plan.price}/mo`}
            </button>
          </div>
        ))}
      </div>

      {/* Top-ups Section */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Need More?</h2>
        <p className="text-sm text-dark-200 mb-4">Buy top-up packs anytime. No subscription change needed.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TopupCard seconds={60} price={199} perSec="₹3.32/s" />
          <TopupCard seconds={180} price={499} perSec="₹2.77/s" popular />
          <TopupCard seconds={360} price={899} perSec="₹2.50/s" />
        </div>
        <p className="text-xs text-dark-300 mt-3">
          Top-ups expire 60 days after purchase. Active subscription required.
        </p>
      </div>

      {/* Avatar Setup */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Avatar Setup Add-on</h2>
            <p className="text-sm text-dark-200 mt-1">
              Create your personal Digital Twin. One-time purchase per avatar.
            </p>
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-dark-100 flex items-center gap-1.5">
                <span className="text-brand-400">•</span> AI avatar trained on your likeness
              </li>
              <li className="text-xs text-dark-100 flex items-center gap-1.5">
                <span className="text-brand-400">•</span> Consent-verified identity flow
              </li>
              <li className="text-xs text-dark-100 flex items-center gap-1.5">
                <span className="text-brand-400">•</span> Stored permanently while subscribed
              </li>
            </ul>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">₹849</p>
            <p className="text-xs text-dark-300">one-time</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">FAQs</h2>
        <div className="space-y-4">
          <FAQ
            q="What happens if I run out of monthly seconds?"
            a="Video generation will be blocked until you buy a top-up or your credits reset on the next billing cycle."
          />
          <FAQ
            q="Can I switch plans?"
            a="Cancel your current plan and subscribe to a new one. The new plan takes effect immediately on the next billing cycle."
          />
          <FAQ
            q="What if I cancel?"
            a="You retain access until the end of your current billing period. After that, generation is blocked but your avatars/videos remain accessible."
          />
          <FAQ
            q="Do unused seconds roll over?"
            a="Monthly seconds do NOT roll over. Top-up seconds expire 60 days after purchase."
          />
        </div>
      </div>
    </div>
  );
}

function TopupCard({ seconds, price, perSec, popular }: { seconds: number; price: number; perSec: string; popular?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border transition-all ${
      popular ? 'border-brand-500/50 bg-brand-500/5' : 'border-dark-400/30 bg-dark-700/30'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium">{seconds}s</p>
          <p className="text-xs text-dark-200">{perSec}</p>
        </div>
        <p className="text-lg font-bold text-white">₹{price}</p>
      </div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-slate-300 hover:text-white transition-colors">
        {q}
      </summary>
      <p className="mt-1.5 text-xs text-dark-200 pl-4">{a}</p>
    </details>
  );
}
