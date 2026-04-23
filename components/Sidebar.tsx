'use client';

import type { AppView } from '@/types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const steps: { id: AppView; label: string; num: number }[] = [
  { id: 'generate', label: 'Character', num: 1 },
  { id: 'gallery', label: 'Review', num: 2 },
  { id: 'animate', label: 'Animate', num: 3 },
];

const stepOrder: Record<AppView, number> = { generate: 1, gallery: 2, animate: 3 };

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const currentStep = stepOrder[currentView];

  return (
    <aside className="w-52 flex-shrink-0 bg-[#111111] border-r border-[#2a2a2a] flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-sm font-bold text-white">
            S
          </div>
          <span className="font-semibold text-sm text-white">Sprite Sheets AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {([
          { id: 'generate' as AppView, label: 'AI Generate' },
          { id: 'gallery' as AppView, label: 'Gallery' },
          { id: 'animate' as AppView, label: 'Animate & Export' },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              currentView === item.id
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Step indicator */}
      <div className="px-4 pb-6 space-y-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Workflow</p>
        {steps.map((step, i) => {
          const isActive = step.num === currentStep;
          const isCompleted = step.num < currentStep;
          return (
            <div key={step.id} className="relative">
              {i < steps.length - 1 && (
                <div
                  className={`absolute left-3 top-6 w-0.5 h-6 ${
                    isCompleted ? 'bg-blue-500' : 'bg-[#2a2a2a]'
                  }`}
                />
              )}
              <button
                onClick={() => onNavigate(step.id)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500'
                      : 'bg-[#2a2a2a] text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <span
                  className={`text-xs transition-colors ${
                    isActive
                      ? 'text-white font-medium'
                      : isCompleted
                      ? 'text-blue-400'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
