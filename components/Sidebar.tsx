'use client';

import type { AppView, GalleryItem } from '@/types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  recentItems: GalleryItem[];
  onRecentClick: (item: GalleryItem) => void;
}

function resolveActiveNav(view: AppView): AppView {
  if (view === 'review' || view === 'animate') return 'generate';
  return view;
}

const NAV_ITEMS: { id: AppView; label: string; icon: string }[] = [
  { id: 'video', label: 'Video to Sprite', icon: 'video' },
  { id: 'generate', label: 'AI Generate', icon: 'sparkles' },
  { id: 'gallery', label: 'Gallery', icon: 'grid' },
];

function NavIcon({ name }: { name: string }) {
  if (name === 'video') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    );
  }
  if (name === 'sparkles') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M5 3l14 9-14 9V3z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

export default function Sidebar({ currentView, onNavigate, recentItems, onRecentClick }: SidebarProps) {
  const activeNav = resolveActiveNav(currentView);

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-screen"
      style={{
        backgroundColor: 'var(--sidebar-background)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold"
          style={{
            backgroundColor: 'var(--sidebar-primary)',
            color: 'var(--sidebar-primary-foreground)',
          }}
        >
          S
        </div>
        <span className="font-semibold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
          Sprite Sheets AI
        </span>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-3 space-y-0.5 flex-shrink-0">
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--sidebar-primary)' : 'transparent',
                color: isActive
                  ? 'var(--sidebar-primary-foreground)'
                  : 'var(--sidebar-foreground)',
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--sidebar-accent)';
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Recent */}
      {recentItems.length > 0 && (
        <div className="mt-4 flex-1 min-h-0 flex flex-col px-3">
          <p
            className="text-[10px] font-medium uppercase tracking-wider px-1 mb-2 flex-shrink-0"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Recent
          </p>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {recentItems.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onRecentClick(item)}
                  className="group relative aspect-square rounded-md overflow-hidden"
                  style={{ backgroundColor: 'var(--muted)' }}
                  title={item.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${item.mimeType};base64,${item.imageBase64}`}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] truncate opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' }}
                  >
                    {item.name.slice(0, 10)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div
        className="p-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <button
          className="w-full flex items-center gap-2.5 p-2 rounded-md transition-colors"
          style={{ color: 'var(--sidebar-foreground)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sidebar-accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            A
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>
              Andres
            </p>
            <p className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>
              free
            </p>
          </div>
          <svg
            className="w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--muted-foreground)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
