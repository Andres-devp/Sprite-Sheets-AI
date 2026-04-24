'use client';

import type { ChromaKeySettings } from '@/types';

const RESOLUTIONS = [128, 256, 512, 1024] as const;

interface VideoRightSidebarProps {
  chromaSettings: ChromaKeySettings;
  onChromaChange: (s: ChromaKeySettings) => void;
  fps: number;
  onFpsChange: (v: number) => void;
  cols: number;
  onColsChange: (v: number) => void;
  resolution: number;
  onResolutionChange: (v: number) => void;
  totalFrames: number;
  selectedFrames: number;
  onExportZip: () => void;
  onExportGrid: () => void;
  isExporting: boolean;
  hasFrames: boolean;
}

export default function VideoRightSidebar({
  chromaSettings,
  onChromaChange,
  fps,
  onFpsChange,
  cols,
  onColsChange,
  resolution,
  onResolutionChange,
  totalFrames,
  selectedFrames,
  onExportZip,
  onExportGrid,
  isExporting,
  hasFrames,
}: VideoRightSidebarProps) {
  const { tolerance, erosion, edgeSoftness } = chromaSettings;

  return (
    <aside
      className="w-72 flex-shrink-0 overflow-y-auto flex flex-col gap-6 px-4 py-5"
      style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
    >
      {/* Background Removal */}
      <section>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Background Removal
        </p>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-[#00FF00] border" style={{ borderColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>#00FF00 chroma key</span>
        </div>

        {(
          [
            { label: 'Tolerance', value: tolerance, min: 0, max: 150, key: 'tolerance' },
            { label: 'Erosion', value: erosion, min: 0, max: 20, key: 'erosion' },
            { label: 'Edge Softness', value: edgeSoftness, min: 0, max: 20, key: 'edgeSoftness' },
          ] as const
        ).map(({ label, value, min, max, key }) => (
          <div key={key} className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--foreground)' }}>{label}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{value}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) =>
                onChromaChange({ ...chromaSettings, [key]: Number(e.target.value) })
              }
              className="w-full cursor-pointer accent-blue-500"
            />
          </div>
        ))}
      </section>

      {/* Framing */}
      <section>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Framing
        </p>

        {/* FPS */}
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--foreground)' }}>Frame Rate</span>
            <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{fps} fps</span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => onFpsChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
          <div
            className="flex justify-between text-[10px] mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <span>1</span>
            <span>60</span>
          </div>
        </div>

        {/* Frame Size */}
        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: 'var(--foreground)' }}>Frame Size</p>
          <div className="grid grid-cols-4 gap-1">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                onClick={() => onResolutionChange(r)}
                className="py-1.5 text-[10px] rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: resolution === r ? 'var(--accent)' : 'var(--muted)',
                  color: resolution === r ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Columns */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--foreground)' }}>Columns</span>
            <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{cols}</span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            value={cols}
            onChange={(e) => onColsChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
          <div
            className="flex justify-between text-[10px] mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <span>1</span>
            <span>12</span>
          </div>
        </div>
      </section>

      {/* Export Settings */}
      <section>
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Export Settings
        </p>

        {/* Columns */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--foreground)' }}>Columns</span>
            <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{cols}</span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            value={cols}
            onChange={(e) => onColsChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
          <div
            className="flex justify-between text-[10px] mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <span>1</span>
            <span>12</span>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="mt-auto">
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {hasFrames
            ? `${selectedFrames} / ${totalFrames} frames selected`
            : 'No frames loaded'}
        </p>
      </section>
    </aside>
  );
}
