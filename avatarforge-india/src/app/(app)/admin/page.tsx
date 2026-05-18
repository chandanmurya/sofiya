'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    try {
      const res = await fetch('/api/admin');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-600 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-dark-600 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="page-container">
      <h1 className="page-title">Admin Panel</h1>
      <p className="page-subtitle">System overview and management.</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <AdminStat label="Total Users" value={stats?.totalUsers || 0} />
        <AdminStat label="Active Subscriptions" value={stats?.activeSubscriptions || 0} />
        <AdminStat label="Videos Generated" value={stats?.totalVideosGenerated || 0} />
        <AdminStat label="Failed Jobs" value={stats?.failedJobs || 0} highlight={stats?.failedJobs > 0} />
      </div>

      {/* Revenue vs Costs */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-dark-100 mb-2">Revenue (INR)</h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-dark-200">This Month</p>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(stats?.revenue?.thisMonth || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-dark-200">Last Month</p>
              <p className="text-lg text-dark-100">
                {formatCurrency(stats?.revenue?.lastMonth || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-dark-100 mb-2">API Costs (INR)</h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-dark-200">This Month</p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(stats?.apiCosts?.thisMonth || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-dark-200">Last Month</p>
              <p className="text-lg text-dark-100">
                {formatCurrency(stats?.apiCosts?.lastMonth || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Margin */}
      {stats && (
        <div className="glass-card p-4 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-100">Profit Margin (This Month)</span>
            <span className={`text-sm font-bold ${
              (stats.revenue.thisMonth - stats.apiCosts.thisMonth) > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {stats.revenue.thisMonth > 0
                ? `${Math.round(((stats.revenue.thisMonth - stats.apiCosts.thisMonth) / stats.revenue.thisMonth) * 100)}%`
                : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Failed Jobs */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Failed Jobs</h2>
        {data?.recentFailedJobs?.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentFailedJobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-dark-600/50 rounded-lg">
                <div>
                  <p className="text-sm text-white">{job.type}</p>
                  <p className="text-xs text-dark-200">
                    {job.user?.email} • {new Date(job.updatedAt).toLocaleString('en-IN')}
                  </p>
                  {job.lastError && (
                    <p className="text-xs text-red-400 mt-1 truncate max-w-md">{job.lastError}</p>
                  )}
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dark-200 text-center py-4">No failed jobs 🎉</p>
        )}
      </div>
    </div>
  );
}

function AdminStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-dark-200">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-red-400' : 'text-white'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
