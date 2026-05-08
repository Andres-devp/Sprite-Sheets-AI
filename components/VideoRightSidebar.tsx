'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChromaKeySettings } from '@/types';
import { hexToRgb } from '@/lib/chromaKey';
import { SectionLabel, Slider, Icon, GlowButton, Badge } from '@/components/Shared';

const FRAME_SIZES = [16, 32, 48, 64, 128, 256] as const;
const MAX_CHROMA_COLORS = 5;

function MultiColorPicker({
  colors,
  onAdd,
  onEdit,
  onRemove,
}: {
  colors: [number, number, number][];
  onAdd: (hex: string) => void;
  onEdit: (index: number, hex: string) => void;
  onRemove: (index: number) => void;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const handleEdit = useCallback((i: number) => {
    setEditIdx(i);
    setTimeout(() => editRef.current?.click(), 0);
  }, []);

  const toHex = (rgb: [number, number, number]) =>
    '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {colors.map((rgb, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => handleEdit(i)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ width: '18px', height: '18px', backgroundColor: toHex(rgb), border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text1)' }}>{toHex(rgb).toUpperCase()}</span>
          </button>
          {colors.length > 1 && (
            <button
              onClick={() => onRemove(i)}
              style={{
                width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {colors.length < MAX_CHROMA_COLORS && (
        <button
          onClick={() => addRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', marginTop: '2px',
            background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)',
            color: 'var(--cyan)', fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}
        >
          + Add color
        </button>
      )}
      <input
        ref={addRef} type="color" defaultValue="#ffffff"
        onChange={(e) => onAdd(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />
      <input
        ref={editRef} type="color"
        value={editIdx !== null ? toHex(colors[editIdx] ?? [0, 255, 0]) : '#00ff00'}
        onChange={(e) => { if (editIdx !== null) onEdit(editIdx, e.target.value); }}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />
    </div>
  );
}

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

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`toggle-track${value ? ' on' : ''}`}
      style={{ flexShrink: 0, width: '36px', height: '20px' }}
    >
      <div className="toggle-thumb" style={{ width: '14px', height: '14px' }} />
    </button>
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
  const DEFAULT_SCALE = 180;
  const MIN_SCALE = 60;
  const MAX_SCALE = 300;
  const SCALE_STEP = 20;

  // ── Preview animation state ───────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(fps);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPlaybackSpeed(fps), 0);
    return () => clearTimeout(t);
  }, [fps]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && previewFrames.length > 0) {
      intervalRef.current = setInterval(() => {
        setPreviewIdx((i) => (i + 1) % previewFrames.length);
      }, Math.round(1000 / playbackSpeed));
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, previewFrames.length, playbackSpeed]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewIdx(0);
      setIsPlaying(previewFrames.length > 0);
    }, 0);
    return () => clearTimeout(t);
  }, [previewFrames.length]);

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
    onChromaChange({ targetColors: [[0, 255, 0]], tolerance: 8, erosion: 1, edgeSoftness: 0 });

  const addChromaColor = (hex: string) => {
    const rgb = hexToRgb(hex);
    const already = chromaSettings.targetColors.some(
      ([r, g, b]) => r === rgb[0] && g === rgb[1] && b === rgb[2]
    );
    if (!already) onChromaChange({ ...chromaSettings, targetColors: [...chromaSettings.targetColors, rgb] });
  };

  const editChromaColor = (index: number, hex: string) => {
    const updated = chromaSettings.targetColors.map((c, i) => i === index ? hexToRgb(hex) : c);
    onChromaChange({ ...chromaSettings, targetColors: updated });
  };

  const removeChromaColor = (index: number) => {
    onChromaChange({ ...chromaSettings, targetColors: chromaSettings.targetColors.filter((_, i) => i !== index) });
  };

  const rows = selectedFrames > 0 ? Math.ceil(selectedFrames / cols) : 0;
  const sheetW = cols * resolution;
  const sheetH = rows * resolution;

  const asideStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    backgroundColor: 'var(--bg1)',
    gap: '24px',
    animation: 'fadeIn 0.3s ease',
    borderRadius: 'var(--r-lg)',
  };

  // ── Empty sidebar (no frames loaded) ─────────────────────────────────────
  if (!hasFrames) {
    return (
      <aside style={asideStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.01em' }}>Configuration</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Upload a video to configure extraction settings and chroma key.
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SectionLabel>Background Removal</SectionLabel>
          <MultiColorPicker
            colors={chromaSettings.targetColors}
            onAdd={addChromaColor}
            onEdit={editChromaColor}
            onRemove={removeChromaColor}
          />
          <Slider label="Tolerance" value={tolerance} min={0} max={150} onChange={(v: number) => onChromaChange({ ...chromaSettings, tolerance: v })} />
          <Slider label="Erosion" value={erosion} min={0} max={20} onChange={(v: number) => onChromaChange({ ...chromaSettings, erosion: v })} />
          <Slider label="Edge Softness" value={edgeSoftness} min={0} max={20} step={0.1} onChange={(v: number) => onChromaChange({ ...chromaSettings, edgeSoftness: v })} />
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SectionLabel>Framing</SectionLabel>
          <Slider label="Frame Rate" value={fps} min={1} max={60} unit=" fps" onChange={onFpsChange} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>Frame Size</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {FRAME_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => onResolutionChange(s)}
                  style={{
                    padding: '6px 0', fontSize: '12px', fontFamily: 'var(--font-ui)',
                    border: `1px solid ${resolution === s ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-sm)',
                    backgroundColor: resolution === s ? 'var(--cyan-dim)' : 'var(--bg2)',
                    color: resolution === s ? 'var(--cyan)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all 0.15s', fontWeight: resolution === s ? 600 : 400
                  }}
                  onMouseEnter={(e) => { if (resolution !== s) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text1)'; } }}
                  onMouseLeave={(e) => { if (resolution !== s) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; } }}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text1)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>Auto-crop Frames</span>
            <Toggle value={autoCrop} onChange={onAutoCropChange} />
          </div>

          <Slider label="Columns" value={cols} min={1} max={12} onChange={onColsChange} />
        </div>
      </aside>
    );
  }

  // ── Loaded sidebar ────────────────────────────────────────────────────────
  const currentFrame = previewFrames[previewIdx];
  const canDrag = Boolean(currentFrame);
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  const resetView = () => {
    setScale(DEFAULT_SCALE);
    setPan({ x: 0, y: 0 });
  };
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
    setIsDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const scaleFactor = scale / 100;
    setPan({ x: drag.originX + dx / scaleFactor, y: drag.originY + dy / scaleFactor });
  };
  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <aside style={asideStyle}>
      {/* ── Preview pane ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Animation Preview</SectionLabel>
          <Badge color="cyan">{previewFrames.length > 0 ? `${previewIdx + 1}/${previewFrames.length}` : '0/0'}</Badge>
        </div>
        
        <div
          className="checkerboard"
          style={{
            position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
            border: '1px solid var(--border)', height: 240,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--bg0)',
            cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onDoubleClick={resetView}
        >
          {currentFrame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentFrame}
              alt="Preview"
              style={{
                maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale / 100})`,
                transformOrigin: 'center', transition: isDragging ? 'none' : 'transform 0.1s',
              }}
            />
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text3)' }}>No frames</p>
          )}
          
          <button
            onClick={() => setIsPlaying((p) => !p)}
            style={{
              position: 'absolute', bottom: '8px', right: '8px',
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: 'rgba(6,8,16,0.8)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text0)', cursor: 'pointer', transition: 'all 0.2s',
              backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cyan)'; e.currentTarget.style.borderColor = 'var(--cyan)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(6,8,16,0.8)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {isPlaying ? <Icon name="pause" size={14} color="currentColor" /> : <Icon name="play" size={14} color="currentColor" />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={zoomOut}
              style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', cursor: 'pointer' }}
            >
              -
            </button>
            <button
              onClick={zoomIn}
              style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', cursor: 'pointer' }}
            >
              +
            </button>
            <button
              onClick={resetView}
              style={{ height: 28, padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: '12px' }}
            >
              Reset
            </button>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{Math.round(scale)}%</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Drag to pan · Double-click to reset</div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* ── Background Removal ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>Chroma Key</SectionLabel>
          <Badge color="cyan">Active</Badge>
        </div>

        <MultiColorPicker
          colors={chromaSettings.targetColors}
          onAdd={addChromaColor}
          onEdit={editChromaColor}
          onRemove={removeChromaColor}
        />

        <Slider label="Tolerance" value={tolerance} min={0} max={150} onChange={(v: number) => onChromaChange({ ...chromaSettings, tolerance: v })} />
        <Slider label="Erosion" value={erosion} min={0} max={20} onChange={(v: number) => onChromaChange({ ...chromaSettings, erosion: v })} />
        <Slider label="Edge Softness" value={edgeSoftness} min={0} max={20} step={0.1} onChange={(v: number) => onChromaChange({ ...chromaSettings, edgeSoftness: v })} />
        
        <GlowButton variant="ghost" size="sm" onClick={resetChroma} style={{ width: '100%', marginTop: '4px' }}>
          Reset Defaults
        </GlowButton>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* ── Export ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 'auto' }}>
        <SectionLabel>Grid Layout</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>Frame Size</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {FRAME_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => onResolutionChange(s)}
                style={{
                  padding: '6px 0', fontSize: '12px', fontFamily: 'var(--font-ui)',
                  border: `1px solid ${resolution === s ? 'var(--cyan)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                  backgroundColor: resolution === s ? 'var(--cyan-dim)' : 'var(--bg2)',
                  color: resolution === s ? 'var(--cyan)' : 'var(--text2)',
                  cursor: 'pointer', transition: 'all 0.15s', fontWeight: resolution === s ? 600 : 400
                }}
                onMouseEnter={(e) => { if (resolution !== s) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text1)'; } }}
                onMouseLeave={(e) => { if (resolution !== s) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; } }}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Columns</span>
          <span style={{ fontSize: '13px', color: 'var(--cyan)', fontWeight: 500 }}>{cols}</span>
        </div>
        <input type="range" min={1} max={12} value={cols} onChange={(e) => onColsChange(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--cyan)' }} />

        {rows > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg2)', padding: '12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text2)' }}>Layout</span>
              <span style={{ color: 'var(--text1)', fontWeight: 500 }}>{cols} × {rows} grid</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text2)' }}>Frame</span>
              <span style={{ color: 'var(--text1)', fontWeight: 500 }}>{resolution} × {resolution} px</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text2)' }}>Final Sheet</span>
              <span style={{ color: 'var(--text1)', fontWeight: 500 }}>{sheetW} × {sheetH} px</span>
            </div>
          </div>
        )}

        <GlowButton onClick={onExportGrid} disabled={selectedFrames === 0 || isExporting} size="lg" style={{ width: '100%' }}>
          {isExporting ? 'Exporting...' : `Export Grid (${selectedFrames})`}
        </GlowButton>
      </div>
    </aside>
  );
}
