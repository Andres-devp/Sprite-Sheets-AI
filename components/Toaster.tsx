'use client';

import { useState, useEffect } from 'react';
import type { ToastType } from '@/lib/toast';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const STYLES: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: '#0A1A0E', border: '#16a34a', color: '#4ADE80', icon: '✓' },
  error:   { bg: '#1A0A0C', border: 'var(--destructive)', color: '#FF6B77', icon: '!' },
  info:    { bg: '#0D0E08', border: 'var(--accent)', color: 'var(--accent)', icon: 'i' },
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
    <div style={{
      position: 'fixed',
      bottom: 20, right: 20,
      zIndex: 300,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            className="animate-fade-in-up"
            style={{
              backgroundColor: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 3,
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              maxWidth: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              width: 18, height: 18,
              borderRadius: 2,
              border: `1px solid ${s.border}`,
              backgroundColor: `color-mix(in srgb, ${s.border} 15%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 9, fontWeight: 700,
              color: s.color,
              flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--foreground)',
              lineHeight: 1.4,
            }}>
              {t.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
