'use client';

import { useState, useEffect } from 'react';
import type { ToastType } from '@/lib/toast';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const BG: Record<ToastType, string> = {
  success: '#16a34a',
  error: 'var(--destructive)',
  info: 'var(--accent)',
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl animate-fade-in-up"
          style={{
            backgroundColor: BG[t.type],
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            maxWidth: 320,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
