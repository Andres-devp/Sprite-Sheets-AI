# Sprite Sheets AI — Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Video to Sprite view (client-side video upload → frame extraction → chroma key → export), update Sidebar with Recent thumbnails + user profile section, and replace globals.css with HSL design tokens from spec.

**Architecture:** Add `'video'` to `AppView`, lift video controls state (fps/cols/resolution/chromaSettings) into `page.tsx`, create `VideoToSprite` (video dropzone + frame grid with selection/export via an imperative ref handle) and `VideoRightSidebar` (controls panel), rewrite `Sidebar` to include video nav item + 2-col recent grid + user profile. Existing AI Generate / Gallery / Animate panels are untouched except for the Sidebar prop interface change.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, HTML5 Canvas + Video API (client-only), JSZip (already in `node_modules`), existing `applyChromaKey` from `lib/chromaKey.ts`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/globals.css` | Modify | HSL design tokens + bg-checkerboard utility |
| `types/index.ts` | Modify | Add `'video'` to `AppView` |
| `lib/videoExtract.ts` | Create | `extractVideoFrames()` — client-side video → frame data URLs |
| `components/VideoRightSidebar.tsx` | Create | Chroma key sliders, FPS/cols/resolution controls, Export buttons |
| `components/VideoToSprite.tsx` | Create | Video dropzone, frame extraction, selectable frame grid, export via imperative ref |
| `components/Sidebar.tsx` | Modify | Video nav item, Recent 2-col thumbnail grid, user profile section |
| `app/page.tsx` | Modify | Add video state, 3-column layout, wire VideoToSprite + VideoRightSidebar |

---

### Task 1: CSS Design Tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css content**

```css
@import "tailwindcss";

:root {
  --background: hsl(220, 20%, 8%);
  --foreground: hsl(216, 20%, 90%);
  --card: hsl(220, 18%, 11%);
  --card-foreground: hsl(216, 20%, 90%);
  --surface: hsl(220, 16%, 13%);
  --surface-foreground: hsl(216, 20%, 90%);
  --muted: hsl(220, 16%, 14%);
  --muted-foreground: hsl(218, 12%, 48%);
  --accent: hsl(217, 91%, 60%);
  --accent-foreground: hsl(0, 0%, 100%);
  --primary: hsl(216, 20%, 90%);
  --primary-foreground: hsl(220, 20%, 6%);
  --secondary: hsl(220, 16%, 14%);
  --secondary-foreground: hsl(216, 20%, 90%);
  --border: hsl(220, 14%, 18%);
  --input: hsl(220, 14%, 18%);
  --ring: hsl(217, 91%, 60%);
  --radius: 0.75rem;
  --destructive: hsl(0, 84%, 60%);
  --destructive-foreground: hsl(0, 0%, 100%);
  --popover: hsl(220, 18%, 11%);
  --popover-foreground: hsl(216, 20%, 90%);
  --sidebar-background: hsl(222, 22%, 5%);
  --sidebar-foreground: hsl(216, 20%, 90%);
  --sidebar-border: hsl(220, 14%, 14%);
  --sidebar-accent: hsl(220, 18%, 10%);
  --sidebar-accent-foreground: hsl(216, 20%, 90%);
  --sidebar-primary: hsl(217, 91%, 60%);
  --sidebar-primary-foreground: hsl(0, 0%, 100%);
  --sidebar-ring: hsl(217, 91%, 60%);
  --checkerboard-light: hsl(220, 14%, 16%);
  --checkerboard-dark: hsl(220, 16%, 10%);
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

.checkerboard {
  background-image:
    linear-gradient(45deg, var(--checkerboard-dark) 25%, transparent 25%),
    linear-gradient(-45deg, var(--checkerboard-dark) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--checkerboard-dark) 75%),
    linear-gradient(-45deg, transparent 75%, var(--checkerboard-dark) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: var(--checkerboard-light);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: replace globals.css with HSL design tokens and updated checkerboard"
```

---

### Task 2: Update Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add 'video' to AppView (line 3)**

Old:
```typescript
export type AppView = 'generate' | 'review' | 'animate' | 'gallery';
```

New:
```typescript
export type AppView = 'generate' | 'review' | 'animate' | 'gallery' | 'video';
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add video view to AppView union type"
```

---

### Task 3: Create extractVideoFrames Utility

**Files:**
- Create: `lib/videoExtract.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * Extracts frames from a video File at a given FPS using HTMLVideoElement + HTMLCanvasElement.
 * Client-side only.
 */
export async function extractVideoFrames(
  videoFile: File,
  fps: number,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  if (typeof window === 'undefined') throw new Error('extractVideoFrames is client-only');

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;
    video.muted = true;
    video.preload = 'metadata';

    video.addEventListener('loadedmetadata', () => {
      const { duration } = video;
      if (!isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read video duration'));
        return;
      }

      const interval = 1 / fps;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frames: string[] = [];
      let frameIndex = 0;

      const canvas = document.createElement('canvas');
      let ctx: CanvasRenderingContext2D | null = null;

      const captureNext = () => {
        if (frameIndex >= totalFrames) {
          URL.revokeObjectURL(objectUrl);
          resolve(frames);
          return;
        }
        video.currentTime = frameIndex * interval;
      };

      video.addEventListener('seeked', () => {
        if (!ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx = canvas.getContext('2d');
        }
        if (!ctx) { frameIndex++; captureNext(); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/png'));
        onProgress?.(frameIndex + 1, totalFrames);
        frameIndex++;
        captureNext();
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Video failed to load'));
      });

      captureNext();
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Video failed to load metadata'));
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/videoExtract.ts
git commit -m "feat: add extractVideoFrames client-side utility"
```

---

### Task 4: Create VideoRightSidebar

**Files:**
- Create: `components/VideoRightSidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
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

      {/* Export */}
      <section className="mt-auto">
        <p
          className="text-[10px] font-medium uppercase tracking-wider mb-2"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Export
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {hasFrames
            ? `${selectedFrames} / ${totalFrames} frames selected`
            : 'No frames loaded'}
        </p>
        <div className="space-y-2">
          <button
            onClick={onExportZip}
            disabled={!hasFrames || selectedFrames === 0 || isExporting}
            className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {isExporting ? 'Exporting…' : `Export ${selectedFrames || ''} as ZIP`}
          </button>
          <button
            onClick={onExportGrid}
            disabled={!hasFrames || selectedFrames === 0 || isExporting}
            className="w-full py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
              borderColor: 'var(--border)',
            }}
          >
            Export as PNG Grid
          </button>
        </div>
      </section>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/VideoRightSidebar.tsx
git commit -m "feat: add VideoRightSidebar with chroma/framing/export controls"
```

---

### Task 5: Create VideoToSprite

**Files:**
- Create: `components/VideoToSprite.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/VideoToSprite.tsx
git commit -m "feat: add VideoToSprite with video upload, frame extraction, selection, and export"
```

---

### Task 6: Update Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar.tsx entirely**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: update Sidebar with video nav, recent thumbnails grid, and user profile"
```

---

### Task 7: Update page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace page.tsx entirely**

```tsx
'use client';

import { useReducer, useState, useEffect, useRef, useCallback } from 'react';
import type {
  AppState,
  AppAction,
  Sprite,
  SpriteSheet,
  GalleryFilter,
  ChromaKeySettings,
  GalleryItem,
} from '@/types';
import Sidebar from '@/components/Sidebar';
import GeneratePanel from '@/components/GeneratePanel';
import ReviewPanel from '@/components/ReviewPanel';
import AnimatePanel from '@/components/AnimatePanel';
import Gallery from '@/components/Gallery';
import ChromaKeyModal from '@/components/ChromaKeyModal';
import VideoToSprite, { type VideoToSpriteHandle } from '@/components/VideoToSprite';
import VideoRightSidebar from '@/components/VideoRightSidebar';

const initialState: AppState = {
  currentView: 'video',
  sprites: [],
  spriteSheets: [],
  selectedForReview: [],
  selectedSheetId: null,
  galleryFilter: 'all',
  isGenerating: false,
  isAnimating: false,
  error: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload, error: null };

    case 'ADD_SPRITE':
      return {
        ...state,
        sprites: [action.payload, ...state.sprites].slice(0, 30),
        isGenerating: false,
        error: null,
        selectedForReview: [action.payload.id],
        currentView: 'review',
      };

    case 'ADD_SPRITESHEET':
      return {
        ...state,
        spriteSheets: [action.payload, ...state.spriteSheets].slice(0, 30),
        isAnimating: false,
        error: null,
        selectedSheetId: action.payload.id,
        currentView: 'animate',
      };

    case 'UPDATE_SPRITESHEET_FRAMES':
      return {
        ...state,
        spriteSheets: state.spriteSheets.map((ss) =>
          ss.id === action.payload.id ? { ...ss, frames: action.payload.frames } : ss
        ),
      };

    case 'SET_SELECTED_FOR_REVIEW':
      return { ...state, selectedForReview: action.payload };

    case 'SET_SELECTED_SHEET':
      return { ...state, selectedSheetId: action.payload };

    case 'SET_GALLERY_FILTER':
      return { ...state, galleryFilter: action.payload };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload, error: null };

    case 'SET_ANIMATING':
      return { ...state, isAnimating: action.payload, error: null };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isGenerating: false, isAnimating: false };

    case 'DELETE_ITEM':
      return {
        ...state,
        sprites: state.sprites.filter((s) => s.id !== action.payload),
        spriteSheets: state.spriteSheets.filter((ss) => ss.id !== action.payload),
        selectedForReview: state.selectedForReview.filter((id) => id !== action.payload),
        selectedSheetId:
          state.selectedSheetId === action.payload ? null : state.selectedSheetId,
      };

    default:
      return state;
  }
}

function loadInitialState(init: AppState): AppState {
  if (typeof window === 'undefined') return init;
  try {
    const raw = localStorage.getItem('spritesheet-v2');
    if (!raw) return init;
    const saved = JSON.parse(raw) as { sprites?: Sprite[]; spriteSheets?: SpriteSheet[] };
    return { ...init, sprites: saved.sprites ?? [], spriteSheets: saved.spriteSheets ?? [] };
  } catch {
    return init;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState, loadInitialState);
  const [chromaKeyTarget, setChromaKeyTarget] = useState<Sprite | null>(null);

  // Video to Sprite controls — lifted so both VideoToSprite and VideoRightSidebar share them
  const [videoChroma, setVideoChroma] = useState<ChromaKeySettings>({
    targetColor: [0, 255, 0],
    tolerance: 35,
    erosion: 1,
    edgeSoftness: 2,
  });
  const [videoFps, setVideoFps] = useState(12);
  const [videoCols, setVideoCols] = useState(6);
  const [videoResolution, setVideoResolution] = useState(512);
  const [videoStats, setVideoStats] = useState({ total: 0, selected: 0 });
  const [isVideoExporting, setIsVideoExporting] = useState(false);
  const videoRef = useRef<VideoToSpriteHandle>(null);

  const handleVideoStats = useCallback((total: number, selected: number) => {
    setVideoStats({ total, selected });
  }, []);

  const handleExportZip = useCallback(async () => {
    setIsVideoExporting(true);
    try { await videoRef.current?.exportZip(); } finally { setIsVideoExporting(false); }
  }, []);

  const handleExportGrid = useCallback(async () => {
    setIsVideoExporting(true);
    try { await videoRef.current?.exportGrid(); } finally { setIsVideoExporting(false); }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'spritesheet-v2',
        JSON.stringify({ sprites: state.sprites, spriteSheets: state.spriteSheets })
      );
    } catch { /* quota */ }
  }, [state.sprites, state.spriteSheets]);

  const recentItems: GalleryItem[] = [...state.sprites, ...state.spriteSheets]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);

  const handleRecentClick = useCallback((item: GalleryItem) => {
    if (item.type === 'sprite') {
      setChromaKeyTarget(item as Sprite);
    } else {
      dispatch({ type: 'SET_SELECTED_SHEET', payload: item.id });
      dispatch({ type: 'SET_VIEW', payload: 'animate' });
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar
        currentView={state.currentView}
        onNavigate={(view) => dispatch({ type: 'SET_VIEW', payload: view })}
        recentItems={recentItems}
        onRecentClick={handleRecentClick}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto flex flex-col">
          {state.currentView === 'video' && (
            <VideoToSprite
              chromaSettings={videoChroma}
              fps={videoFps}
              cols={videoCols}
              resolution={videoResolution}
              onStatsChange={handleVideoStats}
              exportHandle={videoRef}
            />
          )}
          {state.currentView === 'generate' && (
            <GeneratePanel state={state} dispatch={dispatch} />
          )}
          {state.currentView === 'review' && (
            <ReviewPanel
              state={state}
              dispatch={dispatch}
              onOpenSpritePicker={() => {
                dispatch({ type: 'SET_GALLERY_FILTER', payload: 'sprites' });
                dispatch({ type: 'SET_VIEW', payload: 'gallery' });
              }}
            />
          )}
          {state.currentView === 'animate' && (
            <AnimatePanel state={state} dispatch={dispatch} />
          )}
          {state.currentView === 'gallery' && (
            <Gallery
              state={state}
              dispatch={dispatch}
              onRemoveBg={setChromaKeyTarget}
              onSelectForReview={(ids) => {
                dispatch({ type: 'SET_SELECTED_FOR_REVIEW', payload: ids });
                dispatch({ type: 'SET_VIEW', payload: 'review' });
              }}
            />
          )}
        </main>

        {state.currentView === 'video' && (
          <VideoRightSidebar
            chromaSettings={videoChroma}
            onChromaChange={setVideoChroma}
            fps={videoFps}
            onFpsChange={setVideoFps}
            cols={videoCols}
            onColsChange={setVideoCols}
            resolution={videoResolution}
            onResolutionChange={setVideoResolution}
            totalFrames={videoStats.total}
            selectedFrames={videoStats.selected}
            onExportZip={handleExportZip}
            onExportGrid={handleExportGrid}
            isExporting={isVideoExporting}
            hasFrames={videoStats.total > 0}
          />
        )}
      </div>

      {chromaKeyTarget && (
        <ChromaKeyModal
          sprite={chromaKeyTarget}
          onClose={() => setChromaKeyTarget(null)}
          onAnimate={() => {
            dispatch({ type: 'SET_SELECTED_FOR_REVIEW', payload: [chromaKeyTarget.id] });
            setChromaKeyTarget(null);
            dispatch({ type: 'SET_VIEW', payload: 'review' });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
1. Sidebar shows "Video to Sprite", "AI Generate", "Gallery" nav items
2. Sidebar user profile shows "Andres / free" at the bottom
3. Video to Sprite view is the default — shows video dropzone
4. Drop/select an MP4 → progress spinner → frame grid appears
5. Right sidebar shows chroma/framing/export controls
6. Frame checkboxes toggle correctly
7. "Export as ZIP" downloads a .zip with selected frames as PNGs
8. "Export as PNG Grid" downloads a single PNG grid
9. Navigate to AI Generate → generate flow works (no regression)
10. Gallery shows any saved sprites/sprite sheets

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire video view into layout with 3-column design and lifted controls state"
```

---

## Self-Review

### Spec coverage
| Requirement | Covered by |
|-------------|-----------|
| Video dropzone (MP4) | Task 5 VideoToSprite |
| Frame extraction via canvas at FPS | Task 3 extractVideoFrames |
| Chroma key on extracted frames | Task 5 `applyChromaKey` in runExtraction |
| Re-extract button | Task 5 Re-extract button |
| Export as ZIP | Task 5 `exportZip` via imperative ref |
| Export as PNG grid using Columns | Task 5 `exportGrid` via imperative ref |
| Right sidebar: Tolerance / Erosion / Edge Softness | Task 4 VideoRightSidebar |
| Right sidebar: FPS slider | Task 4 VideoRightSidebar |
| Right sidebar: Frame Size buttons | Task 4 VideoRightSidebar |
| Right sidebar: Columns slider | Task 4 VideoRightSidebar |
| Sidebar "Video to Sprite" nav | Task 6 Sidebar |
| Sidebar "AI Generate" nav | Task 6 Sidebar |
| Sidebar "Gallery" nav | Task 6 Sidebar |
| Sidebar Recent thumbnails (2-col grid) | Task 6 Sidebar |
| Click Recent sprite → ChromaKeyModal | Task 7 handleRecentClick |
| Click Recent spritesheet → Animate | Task 7 handleRecentClick |
| User profile at sidebar bottom | Task 6 Sidebar |
| HSL design tokens | Task 1 globals.css |
| bg-checkerboard utility | Task 1 globals.css |
| 3-column layout (left + main + right) | Task 7 page.tsx |

### Type consistency
- `VideoToSpriteHandle` defined in `VideoToSprite.tsx`, used as `React.RefObject<VideoToSpriteHandle>` in `page.tsx` ✅
- `GalleryItem` (= `Sprite | SpriteSheet`) used for `recentItems` in both `Sidebar` and `page.tsx` ✅
- `ChromaKeySettings` from `types/index.ts` flows through `page.tsx` → `VideoRightSidebar` → `VideoToSprite` ✅
- `AppView` now includes `'video'` — reducer `SET_VIEW` and `Sidebar.onNavigate` both accept it ✅
- `resolveActiveNav` maps `'review' | 'animate'` → `'generate'` so those sub-views don't break nav highlight ✅
