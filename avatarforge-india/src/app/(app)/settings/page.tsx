'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [locale, setLocale] = useState<'en' | 'hi'>('en');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleLanguageChange(newLocale: 'en' | 'hi') {
    setLocale(newLocale);
    toast.success(newLocale === 'en' ? 'Language set to English' : 'भाषा हिंदी में बदली गई');
  }

  function handleDeleteRequest() {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    toast.success('Deletion request submitted. Our team will process it within 48 hours.');
    setShowDeleteModal(false);
    setDeleteConfirm('');
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences.</p>
      </div>

      {/* ─── Profile ──────────────────────────────────────── */}
      <Card className="mb-5">
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information.</CardDescription>

        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-brand-400">
                {session?.user?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="text-white font-medium">{session?.user?.name || 'User'}</p>
              <p className="text-sm text-dark-200">{session?.user?.email || ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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

          <p className="text-[11px] text-dark-300">
            Profile info is managed through your sign-in provider (Google) and cannot be edited here.
          </p>
        </div>
      </Card>

      {/* ─── Language ─────────────────────────────────────── */}
      <Card className="mb-5">
        <CardTitle>Language / भाषा</CardTitle>
        <CardDescription>Choose your preferred UI language.</CardDescription>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className={`p-4 rounded-xl border text-center transition-all ${
              locale === 'en'
                ? 'border-brand-500/60 bg-brand-500/10'
                : 'border-dark-400/20 hover:border-dark-400/40 hover:bg-dark-600/30'
            }`}
          >
            <p className={`font-medium ${locale === 'en' ? 'text-brand-400' : 'text-white'}`}>English</p>
            <p className="text-[11px] text-dark-300 mt-0.5">Default</p>
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('hi')}
            className={`p-4 rounded-xl border text-center transition-all ${
              locale === 'hi'
                ? 'border-brand-500/60 bg-brand-500/10'
                : 'border-dark-400/20 hover:border-dark-400/40 hover:bg-dark-600/30'
            }`}
          >
            <p className={`font-medium ${locale === 'hi' ? 'text-brand-400' : 'text-white'}`}>हिंदी / Hinglish</p>
            <p className="text-[11px] text-dark-300 mt-0.5">Hindi labels</p>
          </button>
        </div>
      </Card>

      {/* ─── Notifications ────────────────────────────────── */}
      <Card className="mb-5">
        <CardTitle>Notifications</CardTitle>
        <CardDescription>How you want to be notified.</CardDescription>

        <div className="mt-5 space-y-3">
          {[
            { label: 'Video generation complete', desc: 'Get notified when a video finishes', checked: true },
            { label: 'Avatar training complete', desc: 'Get notified when avatar is ready', checked: true },
            { label: 'Payment receipts', desc: 'Email receipts for subscription charges', checked: true },
            { label: 'Product updates', desc: 'New features and improvements', checked: false },
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-dark-600/20 transition-colors cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={item.checked}
                className="mt-0.5 rounded border-dark-400 bg-dark-600 text-brand-500 focus:ring-brand-500/50"
              />
              <div>
                <p className="text-sm text-white">{item.label}</p>
                <p className="text-[11px] text-dark-300">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* ─── Danger Zone ──────────────────────────────────── */}
      <Card className="border-red-500/10">
        <CardTitle className="text-red-400">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions. Please be careful.
        </CardDescription>

        <div className="mt-5 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
          <h4 className="text-sm text-white font-medium mb-1">Delete Account & Data</h4>
          <p className="text-xs text-dark-200 mb-4 leading-relaxed">
            This will permanently delete your account, all avatars, voice clones, generated videos, 
            and usage history. This action cannot be undone. Your subscription will be cancelled immediately.
          </p>

          {!showDeleteModal ? (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
              Request Data Deletion
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-red-300">
                Type <span className="font-mono font-bold">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="input-field text-sm border-red-500/30 focus:ring-red-500/30"
                placeholder="Type DELETE"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteRequest}
                  disabled={deleteConfirm !== 'DELETE'}
                >
                  Confirm Deletion
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
