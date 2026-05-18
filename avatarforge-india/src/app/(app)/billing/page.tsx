'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface BillingData {
  subscription: any;
  wallet: {
    monthlyIncludedSeconds: number;
    monthlyRemaining: number;
    topupSeconds: number;
    totalAvailable: number;
    totalSecondsEarned: number;
    totalSecondsSpent: number;
    monthlyResetAt: string;
  };
  isActive: boolean;
  isBlocked: boolean;
  isGrace: boolean;
  plans: any[];
  topupOptions: any[];
  avatarSetupPrice: any;
  invoices: any[];
  recentUsage: any[];
}

export default function BillingPage() {
  const router = useRouter();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchBilling();
    loadRazorpayScript();
  }, []);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function loadRazorpayScript() {
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }

  async function handleTopup(topupId: string) {
    setPurchasing(topupId);
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topupId }),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      // Open Razorpay Checkout
      const options = {
        key: json.data.razorpayKeyId,
        amount: json.data.amount,
        currency: json.data.currency,
        name: 'AvatarForge India',
        description: `Top-up: +${json.data.seconds} seconds`,
        order_id: json.data.orderId,
        prefill: json.data.prefill,
        theme: { color: '#5c7cfa' },
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch('/api/billing/topup', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: json.data.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            toast.success(verifyData.data.message);
            fetchBilling(); // refresh
          } else {
            toast.error('Payment verification failed');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure? Your subscription will remain active until the end of the billing period.')) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: false }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message);
        fetchBilling();
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-600 rounded w-48" />
          <div className="h-40 bg-dark-600 rounded-xl" />
          <div className="h-60 bg-dark-600 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container text-center">
        <p className="text-dark-200">Failed to load billing data.</p>
      </div>
    );
  }

  const { subscription, wallet, isActive, isBlocked, isGrace, topupOptions, invoices, recentUsage } = data;
  const usagePercent = wallet.monthlyIncludedSeconds > 0
    ? Math.round(((wallet.monthlyIncludedSeconds - wallet.monthlyRemaining) / wallet.monthlyIncludedSeconds) * 100)
    : 0;

  return (
    <div className="page-container max-w-4xl mx-auto">
      <h1 className="page-title">Billing & Usage</h1>
      <p className="page-subtitle">Manage your subscription and monitor credit usage.</p>

      {/* Status Alerts */}
      {isBlocked && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium">⚠️ Account Blocked</p>
          <p className="text-red-300 text-xs mt-1">Payment overdue. Please update your payment method to resume video generation.</p>
        </div>
      )}
      {isGrace && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm font-medium">⚠️ Payment Failed</p>
          <p className="text-yellow-300 text-xs mt-1">
            Grace period active until {subscription?.gracePeriodEnd ? new Date(subscription.gracePeriodEnd).toLocaleDateString('en-IN') : '—'}.
            Please fix your payment to avoid service interruption.
          </p>
        </div>
      )}

      {/* Usage Meter */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Video Credits</h2>
            <p className="text-xs text-dark-200 mt-0.5">1 credit = 1 second of video</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-400">{wallet.totalAvailable}s</p>
            <p className="text-xs text-dark-200">available</p>
          </div>
        </div>

        {/* Monthly bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-dark-200 mb-1">
            <span>Monthly: {wallet.monthlyRemaining}s remaining</span>
            <span>{wallet.monthlyIncludedSeconds}s total</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${100 - (wallet.monthlyRemaining / Math.max(wallet.monthlyIncludedSeconds, 1)) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-dark-300 mt-1">
            Resets on next billing cycle
            {wallet.monthlyResetAt && ` (last reset: ${new Date(wallet.monthlyResetAt).toLocaleDateString('en-IN')})`}
          </p>
        </div>

        {/* Topup balance */}
        {wallet.topupSeconds > 0 && (
          <div className="p-3 bg-dark-600/50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎁</span>
              <span className="text-sm text-dark-100">Top-up balance</span>
            </div>
            <span className="text-sm font-medium text-white">{wallet.topupSeconds}s</span>
          </div>
        )}

        {/* Lifetime stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-dark-600/30 rounded-lg">
            <p className="text-xs text-dark-200">Total earned</p>
            <p className="text-sm font-medium text-white">{wallet.totalSecondsEarned}s</p>
          </div>
          <div className="p-3 bg-dark-600/30 rounded-lg">
            <p className="text-xs text-dark-200">Total used</p>
            <p className="text-sm font-medium text-white">{wallet.totalSecondsSpent}s</p>
          </div>
        </div>
      </div>

      {/* Current Plan */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Current Plan</h2>
            {subscription ? (
              <div className="mt-2">
                <span className="text-brand-400 font-bold text-xl">{subscription.plan}</span>
                <span className={`ml-3 text-xs px-2 py-0.5 rounded-full ${
                  subscription.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                  subscription.status === 'GRACE' ? 'bg-yellow-500/20 text-yellow-400' :
                  subscription.status === 'CANCELLED' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {subscription.status}
                </span>
                {subscription.currentPeriodEnd && (
                  <p className="text-xs text-dark-200 mt-1">
                    {subscription.status === 'CANCELLED' ? 'Active until' : 'Renews on'}: {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-dark-200 mt-1">No active subscription</p>
            )}
          </div>
          <div className="flex gap-2">
            {!subscription || subscription.status === 'INACTIVE' ? (
              <button onClick={() => router.push('/pricing')} className="btn-primary text-sm">
                Subscribe
              </button>
            ) : (
              <>
                <button onClick={() => router.push('/pricing')} className="btn-secondary text-sm">
                  Change Plan
                </button>
                {['ACTIVE', 'GRACE'].includes(subscription?.status) && (
                  <button onClick={handleCancel} disabled={cancelling} className="text-sm text-red-400 hover:text-red-300 px-3">
                    {cancelling ? '...' : 'Cancel'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top-ups */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Buy More Seconds</h2>
        <p className="text-xs text-dark-200 mb-4">Top-up packs expire after 60 days.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topupOptions.map((opt: any) => (
            <button
              key={opt.id}
              onClick={() => handleTopup(opt.id)}
              disabled={!isActive || !!purchasing}
              className={`p-4 rounded-lg border text-left transition-all hover:border-brand-500/50 ${
                purchasing === opt.id ? 'border-brand-500 bg-brand-500/10' : 'border-dark-400/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">+{opt.seconds}s</p>
                  <p className="text-[10px] text-dark-300">₹{opt.perSecondINR}/sec</p>
                </div>
                <p className="text-lg font-bold text-white">₹{opt.priceINR}</p>
              </div>
              {purchasing === opt.id && <p className="text-xs text-brand-400 mt-1">Opening checkout...</p>}
            </button>
          ))}
        </div>
        {!isActive && (
          <p className="text-xs text-red-400 mt-2">Active subscription required to purchase top-ups.</p>
        )}
      </div>

      {/* Recent Usage */}
      {recentUsage.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Usage</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentUsage.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-2.5 bg-dark-600/30 rounded-lg">
                <div>
                  <p className="text-sm text-white">{u.description || 'Video generation'}</p>
                  <p className="text-[10px] text-dark-300">
                    {new Date(u.createdAt).toLocaleString('en-IN')} • From {u.source.toLowerCase()} credits
                  </p>
                </div>
                <span className="text-sm font-medium text-red-400">-{u.secondsUsed}s</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Invoices</h2>
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-dark-600/30 rounded-lg">
                <div>
                  <p className="text-sm text-white">₹{(inv.amount / 100).toFixed(0)}</p>
                  <p className="text-[10px] text-dark-300">
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
