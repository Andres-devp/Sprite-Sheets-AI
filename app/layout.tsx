import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Sprite Sheets AI',
  description: 'Generate game sprite sheets with AI — for indie developers and digital artists.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="bg-[#0a0a0a] text-gray-100 antialiased">{children}</body>
    </html>
  );
}
