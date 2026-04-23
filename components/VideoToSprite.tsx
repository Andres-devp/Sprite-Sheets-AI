'use client';

import { useState, useRef, useCallback, useEffect, useImperativeHandle } from 'react';
import JSZip from 'jszip';
import type { ChromaKeySettings } from '@/types';
import { applyChromaKey } from '@/lib/chromaKey';
import { extractVideoFrames } from '@/lib/videoExtract';

export interface VideoToSpriteHandle {
  exportZip: () => Promise<void>;
  exportGrid: () => Promise<void>;
}

interface VideoToSpriteProps {
  chromaSettings: ChromaKeySettings;
  fps: number;
  cols: number;
  resolution: number;
  onStatsChange: (total: number, selected: number) => void;
  exportHandle: React.RefObject<VideoToSpriteHandle>;
}

export default function VideoToSprite({
  chromaSettings,
  fps,
  cols,
  resolution,
  onStatsChange,
  exportHandle,
}: VideoToSpriteProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onStatsChange(frames.length, selectedIndices.length);
  }, [frames.length, selectedIndices.length, onStatsChange]);

  const runExtraction = useCallback(
    async (file: File) => {
      setIsExtracting(true);
      setFrames([]);
      setSelectedIndices([]);
      setProgress({ current: 0, total: 0 });
      try {
        const rawFrames = await extractVideoFrames(file, fps, (current, total) =>
          setProgress({ current, total })
        );

        const processed = await Promise.all(
          rawFrames.map(
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
        setSelectedIndices(processed.map((_, i) => i));
      } catch (err) {
        console.error('Extraction failed:', err);
      } finally {
        setIsExtracting(false);
      }
    },
    [fps, chromaSettings]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/')) return;
      setVideoFile(file);
      runExtraction(file);
    },
    [runExtraction]
  );

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
      },
      async exportGrid() {
        if (selectedIndices.length === 0) return;
        const rows = Math.ceil(selectedIndices.length / cols);
        const firstImg = await new Promise<HTMLImageElement>((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = frames[selectedIndices[0]];
        });
        const fw = resolution;
        const fh = Math.round(firstImg.height * (fw / firstImg.width));
        const canvas = document.createElement('canvas');
        canvas.width = fw * cols;
        canvas.height = fh * rows;
        const ctx = canvas.getContext('2d')!;
        await Promise.all(
          selectedIndices.map(
            (fi, i) =>
              new Promise<void>((res) => {
                const img = new Image();
                img.onload = () => {
                  const col = i % cols;
                  const row = Math.floor(i / cols);
                  ctx.drawImage(img, col * fw, row * fh, fw, fh);
                  res();
                };
                img.src = frames[fi];
              })
          )
        );
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoFile?.name.replace(/\.[^.]+$/, '') ?? 'frames'}_grid.png`;
        a.click();
      },
    }),
    [selectedIndices, frames, cols, resolution, videoFile]
  );

  // ── No video ──────────────────────────────────────────────────────────────
  if (!videoFile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-lg border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-colors"
          style={{
            borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
            backgroundColor: isDragging ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <svg
              className="w-7 h-7"
              style={{ color: 'var(--muted-foreground)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
              Drop a video file here
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              MP4, WebM, MOV — or click to browse
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
    <div className="flex-1 overflow-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate" style={{ color: 'var(--foreground)' }}>
            {videoFile.name}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {frames.length} frames extracted · {selectedIndices.length} selected
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setSelectedIndices(frames.map((_, i) => i))}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            All
          </button>
          <button
            onClick={() => setSelectedIndices([])}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            None
          </button>
          <button
            onClick={() => runExtraction(videoFile)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'var(--secondary)',
              color: 'var(--secondary-foreground)',
              border: '1px solid var(--border)',
            }}
          >
            Re-extract
          </button>
          <button
            onClick={() => { setVideoFile(null); setFrames([]); setSelectedIndices([]); }}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            Change Video
          </button>
        </div>
      </div>

      {/* Frame grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {frames.map((frame, i) => {
          const isSelected = selectedIndices.includes(i);
          const order = selectedIndices.indexOf(i);
          return (
            <button
              key={i}
              onClick={() => toggleFrame(i)}
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
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              {isSelected && (
                <div
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  {order + 1}
                </div>
              )}
              <div
                className="absolute bottom-0.5 left-0.5 text-[9px] rounded px-0.5"
                style={{ color: '#aaa', backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                {i + 1}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
