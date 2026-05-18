import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/layout/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AvatarForge India - Create Your AI Digital Twin',
  description: 'Create AI avatar clones, clone your voice, and generate professional videos with your digital twin. Made for Indian creators.',
  keywords: ['AI avatar', 'digital twin', 'video generation', 'HeyGen', 'Indian creators'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
