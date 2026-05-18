'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#25262B',
            color: '#C1C2C5',
            border: '1px solid #373A40',
          },
          success: {
            iconTheme: { primary: '#5c7cfa', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#fa5252', secondary: '#fff' },
          },
        }}
      />
    </SessionProvider>
  );
}
