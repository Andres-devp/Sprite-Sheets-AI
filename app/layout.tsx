import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SpriteCraft — AI Sprite Sheet Generator',
  description: 'Generate game sprite sheets with AI — for indie developers and digital artists.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${plusJakartaSans.variable} h-full`}>
      <body className="antialiased overflow-hidden h-full m-0 p-0" suppressHydrationWarning>
        <div id="root" className="h-full flex overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
