'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', nameHi: 'डैशबोर्ड', href: '/dashboard', icon: '⚡' },
  { name: 'Create Avatar', nameHi: 'अवतार बनाएं', href: '/create-avatar', icon: '🧬' },
  { name: 'Clone Voice', nameHi: 'वॉइस क्लोन', href: '/clone-voice', icon: '🎙️' },
  { name: 'Create Video', nameHi: 'वीडियो बनाएं', href: '/create-video', icon: '🎬' },
  { name: 'My Videos', nameHi: 'मेरे वीडियो', href: '/my-videos', icon: '📹' },
  { name: 'Pricing', nameHi: 'प्लान', href: '/pricing', icon: '💎' },
  { name: 'Billing', nameHi: 'बिलिंग', href: '/billing', icon: '💳' },
  { name: 'Settings', nameHi: 'सेटिंग्स', href: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-dark-800 border-r border-dark-400/30 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-dark-400/30">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AF</span>
          </div>
          <span className="text-lg font-bold text-white">AvatarForge</span>
        </Link>
        <p className="text-xs text-dark-100 mt-1">India Edition</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-dark-100 hover:text-white hover:bg-dark-600/50'
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-dark-400/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center">
            <span className="text-sm font-medium text-brand-400">
              {session?.user?.name?.[0] || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs text-dark-100 truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left text-xs text-dark-100 hover:text-red-400 transition-colors px-3 py-1.5"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
