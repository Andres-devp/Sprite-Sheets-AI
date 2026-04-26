'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChromaKeySettings } from '@/types';

const FRAME_SIZES = [16, 32, 48, 64, 128, 256] as const;

interface VideoRightSidebarProps {
  hasFrames: boolean;
  previewFrames: string[];
  chromaSettings: ChromaKeySettings;
  onChromaChange: (s: ChromaKeySettings) => void;
  fps: number;
  onFpsChange: (v: number) => void;
  cols: number;
  onColsChange: (v: number) => void;
  resolution: number;
  onResolutionChange: (v: number) => void;
  autoCrop: boolean;
  onAutoCropChange: (v: boolean) => void;
  totalFrames: number;
  selectedFrames: number;
  onExportGrid: () => void;
  isExporting: boolean;
}

// ── Shared slider row ─────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--foreground)' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-blue-500"
      />
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'var(--muted-foreground)' }}
    >
      {children}
    </p>
  );
}

export default function VideoRightSidebar({
  hasFrames,
  previewFrames,
  chromaSettings,
  onChromaChange,
  fps,
  onFpsChange,
  cols,
  onColsChange,
  resolution,
  onResolutionChange,
  autoCrop,
  onAutoCropChange,
  selectedFrames,
  onExportGrid,
  isExporting,
}: VideoRightSidebarProps) {
  const { tolerance, erosion, edgeSoftness } = chromaSettings;

  // ── Local preview animation state (loaded sidebar) ────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(fps);
  const [scale, setScale] = useState(100);
  const [xOffset, setXOffset] = useState(50);
  const [yOffset, setYOffset] = useState(50);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync playback speed default with fps prop (deferred to avoid setState-in-effect rule)
  useEffect(() => {
    const t = setTimeout(() => setPlaybackSpeed(fps), 0);
    return () => clearTimeout(t);
  }, [fps]);

  // Animation loop
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && previewFrames.length > 0) {
      intervalRef.current = setInterval(() => {
        setPreviewIdx((i) => (i + 1) % previewFrames.length);
      }, Math.round(1000 / playbackSpeed));
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, previewFrames.length, playbackSpeed]);

  // Auto-play and reset index when a new frame set arrives
  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewIdx(0);
      setIsPlaying(previewFrames.length > 0);
    }, 0);
    return () => clearTimeout(t);
  }, [previewFrames.length]);

  // Space bar toggles play/pause (only when loaded, not while typing)
  useEffect(() => {
    if (!hasFrames) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasFrames]);

  const resetChroma = () =>
    onChromaChange({ targetColor: [0, 255, 0], tolerance: 8, erosion: 1, edgeSoftness: 0 });

  // Sheet dimensions
  const rows = selectedFrames > 0 ? Math.ceil(selectedFrames / cols) : 0;
  const sheetW = cols * resolution;
  const sheetH = rows * resolution;

  // ── EMPTY SIDEBAR ─────────────────────────────────────────────────────────
  if (!hasFrames) {
    return (
      <aside
        className="w-64 flex-shrink-0 overflow-y-auto flex flex-col gap-5 px-4 py-5"
        style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
      >
        {/* Background Removal */}
        <section>
          <SectionLabel>Background Removal</SectionLabel>
          <p className="text-[11px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Upload a video to detect background color
          </p>
          <SliderRow
            label="Tolerance"
            value={tolerance}
            min={0}
            max={150}
            onChange={(v) => onChromaChange({ ...chromaSettings, tolerance: v })}
          />
        </section>

        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        {/* Refinement */}
        <section>
          <SectionLabel>Refinement</SectionLabel>
          <SliderRow
            label="Erosion"
            value={erosion}
            min={0}
            max={20}
            onChange={(v) => onChromaChange({ ...chromaSettings, erosion: v })}
          />
          <SliderRow
            label="Edge Softness"
            value={edgeSoftness}
            min={0}
            max={20}
            step={0.1}
            onChange={(v) => onChromaChange({ ...chromaSettings, edgeSoftness: v })}
          />
        </section>

        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        {/* Framing */}
        <section>
          <SectionLabel>Framing</SectionLabel>

          <SliderRow
            label="Frame Rate"
            value={fps}
            min={1}
            max={60}
            unit=" fps"
            onChange={onFpsChange}
          />

          <div className="mb-3">
            <p className="text-xs mb-2" style={{ color: 'var(--foreground)' }}>Frame Size</p>
            <div className="grid grid-cols-3 gap-1">
              {FRAME_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => onResolutionChange(s)}
                  className="py-1.5 text-[10px] rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: resolution === s ? 'var(--accent)' : 'var(--muted)',
                    color: resolution === s ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-crop toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs" style={{ color: 'var(--foreground)' }}>Auto-crop</span>
            <button
              onClick={() => onAutoCropChange(!autoCrop)}
              className="w-10 h-5 rounded-full transition-colors relative flex-shrink-0"
              style={{ backgroundColor: autoCrop ? 'var(--accent)' : 'var(--muted)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: autoCrop ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          <SliderRow
            label="Columns"
            value={cols}
            min={1}
            max={12}
            onChange={onColsChange}
          />
        </section>
      </aside>
    );
  }

  // ── LOADED SIDEBAR ────────────────────────────────────────────────────────
  const currentFrame = previewFrames[previewIdx];

  return (
    <aside
      className="w-64 flex-shrink-0 overflow-y-auto flex flex-col gap-0 px-4 py-4"
      style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
    >
      {/* Preview pane */}
      <div className="mb-4">
        <div
          className="relative rounded-xl overflow-hidden checkerboard mb-2 flex items-center justify-center"
          style={{ height: 160, backgroundColor: 'var(--background)' }}
        >
          {currentFrame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentFrame}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                imageRendering: 'pixelated',
                transform: `scale(${scale / 100}) translate(${(xOffset - 50) * 1.5}%, ${(yOffset - 50) * 1.5}%)`,
                transformOrigin: 'center',
                transition: 'transform 0.1s',
              }}
            />
          ) : (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No frames</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
          >
            {isPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>
            {previewFrames.length > 0 ? `${previewIdx + 1}/${previewFrames.length}` : '0/0'}
          </span>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 16 }} />

      {/* Background Removal */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Background Removal</SectionLabel>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            Active
          </span>
        </div>

        {/* Chroma color swatch */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg border-2 cursor-pointer flex-shrink-0"
            style={{
              backgroundColor: `rgb(${chromaSettings.targetColor.join(',')})`,
              borderColor: 'var(--border)',
            }}
          />
          <button
            className="w-7 h-7 rounded-lg border flex items-center justify-center text-base transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)',
              backgroundColor: 'var(--muted)',
            }}
          >
            +
          </button>
        </div>

        <SliderRow
          label="Tolerance"
          value={tolerance}
          min={0}
          max={150}
          onChange={(v) => onChromaChange({ ...chromaSettings, tolerance: v })}
        />
        <SliderRow
          label="Erosion"
          value={erosion}
          min={0}
          max={20}
          onChange={(v) => onChromaChange({ ...chromaSettings, erosion: v })}
        />
        <SliderRow
          label="Edge Softness"
          value={edgeSoftness}
          min={0}
          max={20}
          step={0.1}
          onChange={(v) => onChromaChange({ ...chromaSettings, edgeSoftness: v })}
        />

        <button
          onClick={resetChroma}
          className="w-full py-1.5 text-xs rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          Reset
        </button>
      </section>

      <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 16 }} />

      {/* Preview settings */}
      <section className="mb-4">
        <SectionLabel>Preview</SectionLabel>
        <SliderRow label="Scale" value={scale} min={25} max={200} unit="%" onChange={setScale} />
        <SliderRow label="X Offset" value={xOffset} min={0} max={100} unit="%" onChange={setXOffset} />
        <SliderRow label="Y Offset" value={yOffset} min={0} max={100} unit="%" onChange={setYOffset} />
        <SliderRow
          label="Playback Speed"
          value={playbackSpeed}
          min={1}
          max={60}
          unit=" fps"
          onChange={setPlaybackSpeed}
        />
      </section>

      <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 16 }} />

      {/* Export */}
      <section>
        <SectionLabel>Export</SectionLabel>
        <SliderRow label="Columns" value={cols} min={1} max={12} onChange={onColsChange} />
        {rows > 0 && (
          <p className="text-[11px] mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {cols}×{rows} grid · {resolution}×{resolution}px
          </p>
        )}
        {rows > 0 && (
          <p className="text-[11px] mb-3" style={{ color: 'color-mix(in srgb, var(--muted-foreground) 70%, transparent)' }}>
            Sheet: {sheetW}×{sheetH}px
          </p>
        )}
        <button
          onClick={onExportGrid}
          disabled={selectedFrames === 0 || isExporting}
          className="w-full py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          {isExporting ? 'Exporting…' : `Export Grid (${selectedFrames})`}
        </button>
      </section>
    </aside>
  );
}
