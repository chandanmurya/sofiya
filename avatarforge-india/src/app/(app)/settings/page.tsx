'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [locale, setLocale] = useState('en');

  return (
    <div className="page-container max-w-2xl mx-auto">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage your account preferences.</p>

      {/* Profile */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              defaultValue={session?.user?.name || ''}
              className="input-field"
              disabled
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              defaultValue={session?.user?.email || ''}
              className="input-field"
              disabled
            />
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Language / भाषा</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setLocale('en'); toast.success('Language set to English'); }}
            className={`p-4 rounded-lg border transition-all ${
              locale === 'en'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-dark-400/50 text-dark-200 hover:border-dark-300'
            }`}
          >
            <div className="font-medium">English</div>
            <div className="text-xs opacity-70">Default</div>
          </button>
          <button
            onClick={() => { setLocale('hi'); toast.success('भाषा हिंदी में बदली गई'); }}
            className={`p-4 rounded-lg border transition-all ${
              locale === 'hi'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-dark-400/50 text-dark-200 hover:border-dark-300'
            }`}
          >
            <div className="font-medium">हिंदी / Hinglish</div>
            <div className="text-xs opacity-70">Hindi labels</div>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-sm text-dark-200 mb-4">
          Deleting your account will remove all avatars, voices, videos, and data permanently.
        </p>
        <button className="btn-danger text-sm">
          Delete Account
        </button>
      </div>
    </div>
  );
}
