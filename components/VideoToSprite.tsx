'use client';

import { useState, useRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import JSZip from 'jszip';
import type { ChromaKeySettings } from '@/types';
import { applyChromaKey } from '@/lib/chromaKey';
import { extractVideoFrames } from '@/lib/videoExtract';
import { toast } from '@/lib/toast';

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
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {frames.map((frame, i) => {
        const isSelected = selectedSet.has(i);
        const order = orderMap.get(i);
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            className="relative aspect-square rounded-lg overflow-hidden checkerboard transition-all"
            style={{
              outline: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
              outlineOffset: isSelected ? '2px' : '0',
            }}
            title={`Frame ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame}
              alt={`Frame ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            {isSelected && order !== undefined && (
              <div
                className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
              >
                {order}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
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
}

export default function VideoToSprite({
  chromaSettings,
  fps,
  cols,
  resolution,
  onStatsChange,
  onPreviewFramesChange,
  onSpriteSheetSaved,
  exportHandle,
  initialVideoFile,
  onInitialFileLoaded,
}: VideoToSpriteProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Raw frames (no chroma key) — kept so re-processing is instant on settings change
  const rawFramesRef = useRef<string[]>([]);

  // Notify parent of stats + preview frames
  useEffect(() => {
    onStatsChange(frames.length, selectedIndices.length);
  }, [frames.length, selectedIndices.length, onStatsChange]);

  useEffect(() => {
    onPreviewFramesChange?.(selectedIndices.map((i) => frames[i]).filter(Boolean));
  }, [frames, selectedIndices, onPreviewFramesChange]);

  // Apply chroma key to raw frames — fast, no video re-seek
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
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d')!;
                  ctx.drawImage(img, 0, 0);
                  applyChromaKey(ctx, img.width, img.height, chromaSettings);
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

  // Re-apply chroma in real time — debounced 120ms so slider drag stays smooth
  useEffect(() => {
    if (rawFramesRef.current.length === 0) return;
    const timer = setTimeout(() => {
      applyChromaToRaw(rawFramesRef.current);
    }, 120);
    return () => clearTimeout(timer);
  // applyChromaToRaw captures chromaSettings via its own dep; timer debounces rapid changes
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
        // Apply chroma key to freshly extracted frames
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

  // Auto-load video handed off from AnimatePanel
  useEffect(() => {
    if (!initialVideoFile) return;
    queueMicrotask(() => {
      handleFile(initialVideoFile);
      onInitialFileLoaded?.();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoFile]);

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
        canvas.width = fw * cols;
        canvas.height = fw * rows;
        const ctx = canvas.getContext('2d')!;
        await Promise.all(
          selectedIndices.map(
            (fi, i) =>
              new Promise<void>((res) => {
                const img = new Image();
                img.onload = () => {
                  const col = i % cols;
                  const row = Math.floor(i / cols);
                  ctx.drawImage(img, col * fw, row * fw, fw, fw);
                  res();
                };
                img.src = frames[fi];
              })
          )
        );
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        // Save to gallery
        onSpriteSheetSaved?.(base64, cols, rows, fw);

        // Download
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${videoFile?.name.replace(/\.[^.]+$/, '') ?? 'frames'}_grid.png`;
        a.click();
        toast(`Sprite sheet saved (${cols}×${rows} · ${fw}px)`);
      },
    }),
    [selectedIndices, frames, cols, resolution, videoFile, onSpriteSheetSaved]
  );

  // ── Empty / drop zone ─────────────────────────────────────────────────────
  if (!videoFile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
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
          className="w-full max-w-2xl border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
          style={{
            minHeight: 320,
            borderColor: isDragging ? 'var(--accent)' : 'color-mix(in srgb, var(--foreground) 18%, transparent)',
            backgroundColor: isDragging
              ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
              : 'color-mix(in srgb, var(--foreground) 3%, transparent)',
          }}
        >
          {/* Upload icon */}
          <svg
            className="w-10 h-10"
            style={{ color: 'color-mix(in srgb, var(--foreground) 35%, transparent)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Drop your video here
            </p>
            <p className="text-xs mt-1" style={{ color: 'color-mix(in srgb, var(--foreground) 45%, transparent)' }}>
              MP4, WebM, MOV
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      </div>
    );
  }

  // ── Extracting ────────────────────────────────────────────────────────────
  if (isExtracting) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-2 animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Extracting frames… {progress.current}/{progress.total}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{pct}%</p>
        </div>
      </div>
    );
  }

  // ── Has frames ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Top bar — "12/12 frames selected" + Re-extract */}
      <div
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          {selectedIndices.length}/{frames.length} frames selected
          {isProcessing && (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </p>
        <button
          onClick={() => runExtraction(videoFile)}
          className="text-xs font-medium transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.75'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
        >
          Re-extract
        </button>
      </div>

      {/* SELECT FRAMES header */}
      <div
        className="flex items-center justify-between px-5 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Select Frames{' '}
          <span style={{ color: 'var(--foreground)' }}>{selectedIndices.length}/{frames.length}</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedIndices(frames.map((_, i) => i))}
            className="text-xs transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--foreground)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--muted-foreground)'; }}
          >
            All
          </button>
          <button
            onClick={() => setSelectedIndices([])}
            className="text-xs transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--foreground)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--muted-foreground)'; }}
          >
            None
          </button>
        </div>
      </div>

      {/* Frame grid */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <FrameGrid
          frames={frames}
          cols={cols}
          selectedIndices={selectedIndices}
          onToggle={toggleFrame}
        />
      </div>

      {/* Bottom action bar */}
      <div
        className="flex items-center gap-2 px-5 py-3 shrink-0"
        style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
      >
        <button
          onClick={() => exportHandle.current?.exportGrid()}
          disabled={selectedIndices.length === 0}
          className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          Export Grid
        </button>
        <button
          onClick={() => exportHandle.current?.exportZip()}
          disabled={selectedIndices.length === 0}
          title="Export individual PNG frames as ZIP"
          className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          ZIP
        </button>
        <button
          onClick={() => runExtraction(videoFile)}
          className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
