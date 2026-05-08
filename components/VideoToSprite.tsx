'use client';

import { useState, useRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import JSZip from 'jszip';
import type { ChromaKeySettings } from '@/types';
import { applyChromaKey } from '@/lib/chromaKey';
import { setupPixelCanvas } from '@/lib/canvasPixel';
import { extractVideoFrames } from '@/lib/videoExtract';
import { toast } from '@/lib/toast';
import { Icon, GlowButton } from '@/components/Shared';

// ── Frame grid — memoised, O(1) selection lookup, lazy image loading ─────────
function FrameGrid({
  frames,
  cols,
  selectedIndices,
  onToggle,
}: {
  frames: string[];
  cols: number;
  selectedIndices: number[];
  onToggle: (i: number) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedIndices), [selectedIndices]);
  const orderMap = useMemo(
    () => new Map(selectedIndices.map((fi, order) => [fi, order + 1])),
    [selectedIndices]
  );

  return (
    <div
      style={{ display: 'grid', gap: '8px', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {frames.map((frame, i) => {
        const isSelected = selectedSet.has(i);
        const order = orderMap.get(i);
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            style={{
              position: 'relative', aspectRatio: '1', borderRadius: 'var(--r-sm)', overflow: 'hidden',
              backgroundColor: isSelected ? 'var(--cyan-dim)' : 'var(--bg4)',
              border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            title={`Frame ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame}
              alt={`Frame ${i + 1}`}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
            />
            {isSelected && order !== undefined && (
              <div
                style={{
                  position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px',
                  borderRadius: '50%', backgroundColor: 'var(--cyan)', color: 'var(--bg0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 'bold'
                }}
              >
                {order}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '2px', left: '2px', fontSize: '9px', padding: '1px 3px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--text1)' }}>
              {i + 1}
            </div>
          </button>
        );
      })}
    </div>
  );
}

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

async function getOpaqueBounds(dataUrl: string): Promise<Bounds | null> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  const ctx = setupPixelCanvas(canvas, w, h, { pixelRatio: 1, applyStyles: false });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const a = data[row + x * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function getMergedBounds(dataUrls: string[]) {
  const boundsList = await Promise.all(dataUrls.map(getOpaqueBounds));
  const valid = boundsList.filter(Boolean) as Bounds[];
  if (valid.length === 0) return null;

  let minX = valid[0].x;
  let minY = valid[0].y;
  let maxX = valid[0].x + valid[0].width - 1;
  let maxY = valid[0].y + valid[0].height - 1;

  for (const b of valid.slice(1)) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width - 1);
    maxY = Math.max(maxY, b.y + b.height - 1);
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface VideoToSpriteHandle {
  exportZip: () => Promise<void>;
  exportGrid: () => Promise<void>;
}

interface VideoToSpriteProps {
  chromaSettings: ChromaKeySettings;
  fps: number;
  cols: number;
  resolution: number;
  autoCrop: boolean;
  onStatsChange: (total: number, selected: number) => void;
  onPreviewFramesChange?: (frames: string[]) => void;
  onSpriteSheetSaved?: (base64: string, cols: number, rows: number, frameSize: number) => void;
  exportHandle: React.RefObject<VideoToSpriteHandle>;
  initialVideoFile?: File | null;
  onInitialFileLoaded?: () => void;
  initialFrames?: string[] | null;
  onInitialFramesLoaded?: () => void;
}

export default function VideoToSprite({
  chromaSettings,
  fps,
  cols,
  resolution,
  autoCrop,
  onStatsChange,
  onPreviewFramesChange,
  onSpriteSheetSaved,
  exportHandle,
  initialVideoFile,
  onInitialFileLoaded,
  initialFrames,
  onInitialFramesLoaded,
}: VideoToSpriteProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawFramesRef = useRef<string[]>([]);

  useEffect(() => {
    onStatsChange(frames.length, selectedIndices.length);
  }, [frames.length, selectedIndices.length, onStatsChange]);

  useEffect(() => {
    onPreviewFramesChange?.(selectedIndices.map((i) => frames[i]).filter(Boolean));
  }, [frames, selectedIndices, onPreviewFramesChange]);

  const applyChromaToRaw = useCallback(
    async (raw: string[]) => {
      if (raw.length === 0) return;
      setIsProcessing(true);
      try {
        const processed = await Promise.all(
          raw.map(
            (dataUrl) =>
              new Promise<string>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const w = img.naturalWidth;
                  const h = img.naturalHeight;
                  const canvas = document.createElement('canvas');
                  const ctx = setupPixelCanvas(canvas, w, h, { pixelRatio: 1, applyStyles: false });
                  ctx.drawImage(img, 0, 0, w, h);
                  applyChromaKey(ctx, w, h, chromaSettings);
                  resolve(canvas.toDataURL('image/png'));
                };
                img.src = dataUrl;
              })
          )
        );
        setFrames(processed);
      } finally {
        setIsProcessing(false);
      }
    },
    [chromaSettings]
  );

  useEffect(() => {
    if (rawFramesRef.current.length === 0) return;
    const timer = setTimeout(() => {
      applyChromaToRaw(rawFramesRef.current);
    }, 120);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromaSettings]);

  const runExtraction = useCallback(
    async (file: File) => {
      setIsExtracting(true);
      setFrames([]);
      setSelectedIndices([]);
      rawFramesRef.current = [];
      setProgress({ current: 0, total: 0 });
      try {
        const raw = await extractVideoFrames(file, fps, (current, total) =>
          setProgress({ current, total })
        );
        rawFramesRef.current = raw;
        await applyChromaToRaw(raw);
        setSelectedIndices(raw.map((_, i) => i));
      } catch (err) {
        console.error('Extraction failed:', err);
      } finally {
        setIsExtracting(false);
      }
    },
    [fps, applyChromaToRaw]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/')) return;
      setVideoFile(file);
      runExtraction(file);
    },
    [runExtraction]
  );

  useEffect(() => {
    if (!initialVideoFile) return;
    queueMicrotask(() => {
      handleFile(initialVideoFile);
      onInitialFileLoaded?.();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoFile]);

  useEffect(() => {
    if (!initialFrames || initialFrames.length === 0) return;
    queueMicrotask(async () => {
      setVideoFile(null);
      setFrames([]);
      setSelectedIndices([]);
      rawFramesRef.current = initialFrames;
      onInitialFramesLoaded?.();
      await applyChromaToRaw(initialFrames);
      setSelectedIndices(initialFrames.map((_, i) => i));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFrames]);

  const toggleFrame = useCallback((i: number) => {
    setSelectedIndices((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
    );
  }, []);

  useImperativeHandle(
    exportHandle,
    () => ({
      async exportZip() {
        if (selectedIndices.length === 0) return;
        const zip = new JSZip();
        const name = videoFile?.name.replace(/\.[^.]+$/, '') ?? 'frames';
        const folder = zip.folder(name) ?? zip;
        selectedIndices.forEach((fi, i) => {
          const base64 = frames[fi].split(',')[1];
          folder.file(`frame_${String(i + 1).padStart(3, '0')}.png`, base64, { base64: true });
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_frames.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${selectedIndices.length} frame${selectedIndices.length !== 1 ? 's' : ''} exported as ZIP`);
      },
      async exportGrid() {
        if (selectedIndices.length === 0) return;
        const fw = resolution;
        const rows = Math.ceil(selectedIndices.length / cols);
        const canvas = document.createElement('canvas');
        const ctx = setupPixelCanvas(canvas, fw * cols, fw * rows, { pixelRatio: 1, applyStyles: false });
        const cropBounds = autoCrop
          ? await getMergedBounds(selectedIndices.map((fi) => frames[fi]).filter(Boolean))
          : null;
        await Promise.all(
          selectedIndices.map(
            (fi, i) =>
              new Promise<void>((res) => {
                const img = new Image();
                img.onload = () => {
                  const col = i % cols;
                  const row = Math.floor(i / cols);
                  const sw = cropBounds?.width ?? img.naturalWidth;
                  const sh = cropBounds?.height ?? img.naturalHeight;
                  const sx = cropBounds?.x ?? 0;
                  const sy = cropBounds?.y ?? 0;

                  const rawScale = Math.min(fw / sw, fw / sh);
                  const scale = rawScale >= 1
                    ? Math.max(1, Math.floor(rawScale))
                    : rawScale;
                  const dw = Math.max(1, Math.round(sw * scale));
                  const dh = Math.max(1, Math.round(sh * scale));

                  const dx = col * fw + Math.floor((fw - dw) / 2);
                  const dy = row * fw + Math.floor((fw - dh) / 2);

                  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
                  res();
                };
                img.src = frames[fi];
              })
          )
        );
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        onSpriteSheetSaved?.(base64, cols, rows, fw);

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${videoFile?.name.replace(/\.[^.]+$/, '') ?? 'frames'}_grid.png`;
        a.click();
        toast(`Sprite sheet saved (${cols}×${rows} · ${fw}px)`);
      },
    }),
    [selectedIndices, frames, cols, resolution, autoCrop, videoFile, onSpriteSheetSaved]
  );

  // ── Empty / drop zone ─────────────────────────────────────────────────────
  if (!videoFile && frames.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full w-full p-10" style={{ background: 'var(--bg0)', overflowY: 'auto' }}>
        <div
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
          style={{
            borderColor: isDragging ? 'var(--cyan)' : 'var(--border2)',
            backgroundColor: isDragging ? 'var(--cyan-dim)' : 'var(--bg2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--cyan)'; e.currentTarget.style.backgroundColor='var(--cyan-dim)'; }}
          onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.backgroundColor='var(--bg2)'; } }}
        >
          <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)' }}>
            <Icon name="upload" size={28} color="var(--text2)"/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'16px', fontWeight:600, color:'var(--text0)', marginBottom:'6px' }}>Drop video file here</div>
            <div style={{ fontSize:'13px', color:'var(--text3)' }}>MP4, WebM, MOV supported</div>
          </div>
          <GlowButton variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Browse Files</GlowButton>
          <input ref={fileInputRef} type="file" accept="video/*" style={{ display:'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      </div>
    );
  }

  // ── Extracting ────────────────────────────────────────────────────────────
  if (isExtracting) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'32px', animation:'fadeIn 0.3s ease', height: '100%' }}>
        <div style={{ position:'relative', width:'120px', height:'120px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ position:'absolute', top:0, left:0, animation:'spin 3s linear infinite' }}>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="2"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="60 279" strokeLinecap="round"/>
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon name="video" size={32} color="var(--cyan)" />
          </div>
        </div>
        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Extracting Frames</div>
          <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)' }}>Processing video file...</div>
        </div>
        <div style={{ width:'320px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', fontFamily:'var(--font-ui)', color:'var(--text2)' }}>
            <span>{progress.current}/{progress.total} frames</span>
            <span style={{ color:'var(--cyan)' }}>{pct}%</span>
          </div>
          <div style={{ height:'3px', background:'var(--bg5)', borderRadius:'2px', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,var(--cyan2),var(--cyan),var(--purple))', borderRadius:'2px', width:`${pct}%`, transition:'width 0.2s ease', boxShadow:'0 0 10px var(--cyan-glow)' }}/>
          </div>
        </div>
      </div>
    );
  }

  // ── Has frames ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg0)', overflow: 'hidden' }}>

      {/* Top bar — "12/12 frames selected" + Re-extract */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--bg1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text0)' }}>Frame Selection</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedIndices.length}/{frames.length} selected
            {isProcessing && <Icon name="sparkle" size={14} color="var(--cyan)" />}
          </div>
        </div>
        <GlowButton variant="ghost" size="sm" onClick={() => { if (videoFile) runExtraction(videoFile); }} disabled={!videoFile}>
          <Icon name="wand" size={14} /> Re-extract
        </GlowButton>
      </div>

      {/* SELECT FRAMES header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--bg2)' }}>
        <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Select Frames to Keep
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setSelectedIndices(frames.map((_, i) => i))}
            style={{ fontSize: '12px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text2)'}
          >
            All
          </button>
          <button
            onClick={() => setSelectedIndices([])}
            style={{ fontSize: '12px', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text2)'}
          >
            None
          </button>
        </div>
      </div>

      {/* Frame grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <FrameGrid
          frames={frames}
          cols={cols}
          selectedIndices={selectedIndices}
          onToggle={toggleFrame}
        />
      </div>

    </div>
  );
}
