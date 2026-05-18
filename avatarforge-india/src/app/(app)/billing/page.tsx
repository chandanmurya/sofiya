'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency, formatCredits } from '@/lib/utils';

export default function BillingPage() {
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchBilling();
  }, []);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing');
      const data = await res.json();
      if (data.success) setBillingData(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planId: string) {
    setSubscribing(planId);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.success && data.data.shortUrl) {
        // Redirect to Razorpay payment page
        window.location.href = data.data.shortUrl;
      } else {
        throw new Error(data.error || 'Failed to subscribe');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-600 rounded w-32" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-80 bg-dark-600 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const plans = billingData?.plans || {};
  const currentPlan = billingData?.subscription?.plan || 'FREE';
  const credits = billingData?.credits;

  return (
    <div className="page-container">
      <h1 className="page-title">Billing & Plans</h1>
      <p className="page-subtitle">Manage your subscription and credits.</p>

      {/* Credits Overview */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-100">Credits Remaining</p>
            <p className="text-3xl font-bold text-brand-400">
              {formatCredits(credits?.balance || 0)}
            </p>
            <p className="text-xs text-dark-200 mt-1">
              Total earned: {formatCredits(credits?.totalEarned || 0)} • 
              Total used: {formatCredits(credits?.totalSpent || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-dark-100">Current Plan</p>
            <p className="text-xl font-bold text-white">{currentPlan}</p>
          </div>
        </div>
        
        {/* Credits Bar */}
        <div className="mt-4">
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min(100, ((credits?.balance || 0) / (billingData?.subscription?.monthlyCredits || 50)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(plans).map((plan: any) => (
          <div
            key={plan.id}
            className={`glass-card p-6 relative ${
              plan.id === currentPlan ? 'border-brand-500/50' : ''
            } ${plan.id === 'CREATOR' ? 'ring-2 ring-brand-500/30' : ''}`}
          >
            {plan.id === 'CREATOR' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-brand-600 text-white text-xs px-3 py-1 rounded-full">
                  Popular
                </span>
              </div>
            )}
            
            {plan.id === currentPlan && (
              <div className="absolute -top-3 right-4">
                <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">
                  Current
                </span>
              </div>
            )}

            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
            <div className="mt-2 mb-4">
              {plan.priceInr === 0 ? (
                <span className="text-2xl font-bold text-white">Free</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-white">
                    {formatCurrency(plan.priceInr)}
                  </span>
                  <span className="text-dark-200 text-sm">/month</span>
                </>
              )}
            </div>

            <ul className="space-y-2 mb-6">
              {plan.features.map((f: string, i: number) => (
                <li key={i} className="text-xs text-dark-100 flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {plan.id === currentPlan ? (
              <button disabled className="btn-secondary w-full text-sm opacity-50">
                Current Plan
              </button>
            ) : plan.id === 'FREE' ? null : (
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={!!subscribing}
                className="btn-primary w-full text-sm"
              >
                {subscribing === plan.id ? 'Processing...' : 'Subscribe'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invoices */}
      {billingData?.invoices && billingData.invoices.length > 0 && (
        <div className="glass-card p-6 mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Invoices</h2>
          <div className="space-y-2">
            {billingData.invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-dark-600/50 rounded-lg">
                <div>
                  <p className="text-sm text-white">
                    {formatCurrency(inv.amount / 100)}
                  </p>
                  <p className="text-xs text-dark-200">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-IN') : 'Pending'}
                  </p>
                </div>
                <span className={`text-xs ${inv.status === 'PAID' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
