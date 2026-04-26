'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import type { AppState, AppAction } from '@/types';
import { extractFrames } from '@/lib/spriteExtract';
import { extractVideoFrames } from '@/lib/videoExtract';
import { applyChromaKey } from '@/lib/chromaKey';

interface AnimatePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (file: File) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyChromaKeyToDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      applyChromaKey(ctx, img.width, img.height, {
        targetColor: [0, 255, 0],
        tolerance: 35,
        erosion: 1,
        edgeSoftness: 2,
      });
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

async function framesToSpriteSheetBase64(
  frames: string[],
  cols: number,
  frameSize: number,
): Promise<string> {
  const rows = Math.ceil(frames.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = frameSize * cols;
  canvas.height = frameSize * rows;
  const ctx = canvas.getContext('2d')!;

  await Promise.all(
    frames.map(
      (frame, i) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            ctx.drawImage(img, col * frameSize, row * frameSize, frameSize, frameSize);
            resolve();
          };
          img.src = frame;
        }),
    ),
  );

  return canvas.toDataURL('image/png').split(',')[1];
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [{ label: 'Character' }, { label: 'Review' }, { label: 'Animate' }];
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <div className="w-10 h-px" style={{ backgroundColor: 'var(--border)' }} />}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: i + 1 <= step ? 'var(--accent)' : 'var(--muted)',
                color: i + 1 <= step ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span
              className="text-sm"
              style={{
                color: i + 1 === step ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: i + 1 === step ? 500 : 400,
              }}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Processing state ──────────────────────────────────────────────────────────
function ProcessingView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const sourceSprite = state.sprites.find((s) => state.selectedForReview.includes(s.id));

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <Stepper step={3} />
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
          Animating Characters
        </h2>
        <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
          0 of {state.selectedForReview.length} complete — generating animation…
        </p>
        <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
          ⏳ Gradio queue can take <strong>1–3 minutes</strong>. Don&apos;t close this tab.
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
          The AI is rendering your sprite frame by frame via Stable Video Diffusion.
        </p>

        <div className="w-48 h-48 rounded-2xl overflow-hidden mx-auto mb-6 relative" style={{ backgroundColor: '#00FF00' }}>
          {sourceSprite ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:${sourceSprite.mimeType};base64,${sourceSprite.imageBase64}`} alt={sourceSprite.name} className="w-full h-full object-contain" />
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--accent)' }} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ color: 'var(--accent)' }} />
                </svg>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--accent)' }} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ color: 'var(--accent)' }} />
              </svg>
            </div>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })}
          className="text-xs px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

// ── Video Result — matches Step 3 reference screenshots ───────────────────────
function VideoResultView({
  state,
  dispatch,
  onOpenInEditor,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (file: File) => void;
}) {
  const pending = state.pendingVideoResult!;

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState(512);
  const [fps, setFps] = useState(12);
  const [cols, setCols] = useState(6);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const handleDownloadVideo = useCallback(() => {
    const ext = pending.videoMimeType.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = `data:${pending.videoMimeType};base64,${pending.videoBase64}`;
    a.download = `${pending.animationName.replace(/\s+/g, '_')}_animation.${ext}`;
    a.click();
  }, [pending]);

  // Build Blob URL from base64
  useEffect(() => {
    let url = '';
    fetch(`data:${pending.videoMimeType};base64,${pending.videoBase64}`)
      .then((r) => r.blob())
      .then((blob) => { url = URL.createObjectURL(blob); setVideoSrc(url); });
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.videoBase64]);

  const handleOpenInEditor = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      const blob = await fetch(`data:${pending.videoMimeType};base64,${pending.videoBase64}`).then((r) => r.blob());
      const ext = pending.videoMimeType.includes('webm') ? 'webm' : 'mp4';
      const file = new File([blob], `${pending.animationName.replace(/\s+/g, '_')}.${ext}`, { type: pending.videoMimeType });
      dispatch({ type: 'SET_PENDING_VIDEO', payload: null });
      onOpenInEditor(file);
    } finally {
      setIsOpening(false);
    }
  };

  // "Extract All as Sprite Sheets" — extract frames, apply chroma key, create grid, save
  const handleExtractAll = async () => {
    if (isExtracting) return;
    setIsExtracting(true);
    try {
      let rawFrames: string[];

      if (pending.sheetImageBase64) {
        // Sprite sheet fallback path — extract directly from grid image (reliable)
        rawFrames = await extractFrames(
          `data:${pending.sheetMimeType};base64,${pending.sheetImageBase64}`,
          pending.sheetCols ?? 4,
          pending.sheetRows ?? 4,
        );
      } else {
        // True video path — seek through video frames
        const blob = await fetch(`data:${pending.videoMimeType};base64,${pending.videoBase64}`).then((r) => r.blob());
        const file = new File([blob], 'animation.webm', { type: pending.videoMimeType });
        rawFrames = await extractVideoFrames(file, fps);
      }

      // Apply chroma key (remove green background)
      const cleanFrames = await Promise.all(rawFrames.map(applyChromaKeyToDataUrl));

      // Build sprite sheet grid at configured frameSize × cols
      const sheetRows = Math.ceil(cleanFrames.length / cols);
      const sheetBase64 = await framesToSpriteSheetBase64(cleanFrames, cols, frameSize);

      dispatch({
        type: 'ADD_SPRITESHEET',
        payload: {
          id: crypto.randomUUID(),
          type: 'spritesheet',
          name: pending.spriteName,
          animationName: pending.animationName,
          sourcePrompt: '',
          artStyle: '16bit',
          cameraAngle: 'front',
          imageBase64: sheetBase64,
          mimeType: 'image/png',
          cols,
          rows: sheetRows,
          frameSize,
          createdAt: Date.now(),
        },
      });

      // Navigate to gallery after saving (override ADD_SPRITESHEET's animate navigation)
      dispatch({ type: 'SET_VIEW', payload: 'gallery' });
    } catch (err) {
      console.error('Extract failed:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const FRAME_SIZES = [128, 256, 512, 1024];
  const FPS_OPTIONS = [8, 12, 24, 30];
  const COL_OPTIONS = [4, 6, 8];

  const selectClass = 'text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
  const selectStyle = {
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-6 py-10 overflow-auto">
      <div className="w-full max-w-md text-center">
        <Stepper step={3} />

        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
          Animating Characters
        </h2>
        <p className="text-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
          1 of 1 completed
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
          You can navigate away — animations will continue in the background.
        </p>

        {/* Video preview card */}
        <div className="relative rounded-2xl overflow-hidden mx-auto mb-6" style={{ maxWidth: 300, backgroundColor: '#00FF00' }}>
          {videoSrc ? (
            // Video intentionally has no caption/track (short looping sprite animation)
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="w-full block"
              style={{ backgroundColor: '#00FF00' }}
            />
          ) : (
            // While Blob URL is being built, show source sprite as placeholder
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${pending.spriteMimeType};base64,${pending.spriteImageBase64}`}
                alt={pending.spriteName}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--accent)' }} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ color: 'var(--accent)' }} />
                </svg>
              </div>
            </div>
          )}

          {/* Checkmark badge */}
          {videoSrc && (
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* "Open in Editor" overlay */}
          <button
            onClick={handleOpenInEditor}
            disabled={!videoSrc || isOpening}
            className="absolute bottom-0 left-0 right-0 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.85)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.72)'; }}
          >
            {isOpening ? 'Loading…' : 'Open in Editor →'}
          </button>
        </div>

        {/* Controls — Frame Size / FPS / Columns */}
        <div
          className="rounded-xl p-4 mb-4 text-left"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Frame Size</p>
              <select value={frameSize} onChange={(e) => setFrameSize(Number(e.target.value))} className={selectClass} style={selectStyle}>
                {FRAME_SIZES.map((s) => (
                  <option key={s} value={s}>{s}×{s}px</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>FPS</p>
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className={selectClass} style={selectStyle}>
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f} fps</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Columns</p>
              <select value={cols} onChange={(e) => setCols(Number(e.target.value))} className={selectClass} style={selectStyle}>
                {COL_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c} cols</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Download raw video */}
        {videoSrc && (
          <button
            onClick={handleDownloadVideo}
            className="w-full py-2 text-xs font-medium rounded-xl transition-colors mb-4 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Video ({pending.videoMimeType.includes('webm') ? 'WebM' : 'MP4'})
          </button>
        )}

        {/* Extract All button */}
        <button
          onClick={handleExtractAll}
          disabled={isExtracting}
          className="w-full py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          {isExtracting ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extracting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Extract All as Sprite Sheets (1)
            </>
          )}
        </button>

        <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Creates sprite sheets with auto background removal &amp; auto-crop. Edit individually in Gallery → Sprite Sheets.
        </p>

        <button
          onClick={() => { dispatch({ type: 'SET_PENDING_VIDEO', payload: null }); dispatch({ type: 'SET_VIEW', payload: 'review' }); }}
          className="text-xs transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--muted-foreground)'; }}
        >
          Start New Batch
        </button>
      </div>
    </div>
  );
}

// ── Sprite-sheet viewer (for Gallery → existing sprite sheets) ────────────────
function SpriteSheetView({
  state,
  dispatch,
  onOpenInEditor,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (file: File) => void;
}) {
  const sheet = state.spriteSheets.find((s) => s.id === state.selectedSheetId)!;

  const [frames, setFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fps, setFps] = useState(12);
  const [removeGreen, setRemoveGreen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    // Defer reset to satisfy set-state-in-effect lint rule
    const initTimer = setTimeout(() => {
      if (cancelled) return;
      setIsExtracting(true);
      setFrames([]);
      setSelectedIndices([]);
    }, 0);

    extractFrames(`data:${sheet.mimeType};base64,${sheet.imageBase64}`, sheet.cols, sheet.rows)
      .then(async (rawFrames) => {
        if (cancelled) return;
        const processed = removeGreen
          ? await Promise.all(rawFrames.map(applyChromaKeyToDataUrl))
          : rawFrames;
        if (cancelled) return;
        setFrames(processed);
        setSelectedIndices(processed.map((_, i) => i));
        setIsExtracting(false);
      })
      .catch(() => { if (!cancelled) setIsExtracting(false); });

    return () => { cancelled = true; clearTimeout(initTimer); };
  // sheet.id covers all sheet data changes; individual props excluded intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id, removeGreen]);

  useEffect(() => {
    if (selectedIndices.length === 0 || frames.length === 0) return;
    let idx = 0;
    const interval = setInterval(() => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const frameIdx = selectedIndices[idx % selectedIndices.length];
      const dataUrl = frames[frameIdx];
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
      img.src = dataUrl;
      idx++;
    }, Math.round(1000 / fps));
    return () => clearInterval(interval);
  }, [selectedIndices, frames, fps]);

  const toggleFrame = useCallback((i: number) => {
    setSelectedIndices((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b));
  }, []);

  const handleExport = async () => {
    if (selectedIndices.length === 0 || exporting) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const name = `${sheet.name}_${sheet.animationName}`.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
      const folder = zip.folder(name) ?? zip;
      selectedIndices.forEach((fi, i) => {
        folder.file(`frame_${String(i + 1).padStart(3, '0')}.png`, frames[fi].split(',')[1], { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${name}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const handleOpenInEditor = useCallback(async () => {
    if (frames.length === 0) return;
    const framesToUse = selectedIndices.length > 0 ? selectedIndices.map((i) => frames[i]) : frames;
    const firstImg = await new Promise<HTMLImageElement>((res) => {
      const img = new Image(); img.onload = () => res(img); img.src = framesToUse[0];
    });
    const canvas = document.createElement('canvas');
    canvas.width = firstImg.width; canvas.height = firstImg.height;
    const ctx = canvas.getContext('2d')!;
    const imgs = await Promise.all(framesToUse.map((f) => new Promise<HTMLImageElement>((res) => { const img = new Image(); img.onload = () => res(img); img.src = f; })));
    const supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: supported });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.start();
      let fi = 0;
      const iv = setInterval(() => {
        if (fi >= imgs.length) { clearInterval(iv); recorder.stop(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imgs[fi], 0, 0); fi++;
      }, Math.round(1000 / fps));
    });
    const blob = new Blob(chunks, { type: 'video/webm' });
    const file = new File([blob], `${sheet.name}_${sheet.animationName}.webm`, { type: 'video/webm' });
    onOpenInEditor(file);
  }, [frames, selectedIndices, fps, sheet.name, sheet.animationName, onOpenInEditor]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mb-6">
          <Stepper step={3} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Select Frames</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sheet.animationName} — {sheet.name}</p>
            </div>
            <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })} className="flex-shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>← Regenerate</button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => setRemoveGreen((v) => !v)} className="w-9 h-5 rounded-full transition-colors flex-shrink-0" style={{ backgroundColor: removeGreen ? 'var(--accent)' : 'var(--muted)' }}>
            <div className="w-4 h-4 bg-white rounded-full m-0.5 transition-transform" style={{ transform: removeGreen ? 'translateX(16px)' : '' }} />
          </button>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Remove green bg</span>
          <span className="text-xs font-mono ml-4" style={{ color: 'var(--foreground)' }}>SELECT FRAMES {selectedIndices.length}/{frames.length}</span>
          <button onClick={() => setSelectedIndices(frames.map((_, i) => i))} className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>All</button>
          <button onClick={() => setSelectedIndices([])} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>None</button>
        </div>

        {isExtracting ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Extracting {sheet.cols * sheet.rows} frames…
            </div>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${sheet.cols}, minmax(0, 1fr))` }}>
            {frames.map((frame, i) => {
              const isSelected = selectedIndices.includes(i);
              return (
                <button key={i} onClick={() => toggleFrame(i)} className="relative aspect-square rounded-lg overflow-hidden checkerboard" style={{ outline: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)', outlineOffset: '2px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  {isSelected && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}>{selectedIndices.indexOf(i) + 1}</div>}
                  <div className="absolute bottom-0.5 left-0.5 text-[9px] rounded px-0.5" style={{ color: '#aaa', backgroundColor: 'rgba(0,0,0,0.5)' }}>{i + 1}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-64 flex-shrink-0 px-4 py-6 flex flex-col gap-5 overflow-y-auto" style={{ backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>Preview {selectedIndices.length > 0 ? `(${selectedIndices.length} frames)` : ''}</p>
          <div className="aspect-square rounded-lg overflow-hidden checkerboard flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
            {selectedIndices.length > 0 ? <canvas ref={previewCanvasRef} className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} /> : <p className="text-xs text-center px-3" style={{ color: 'var(--muted-foreground)' }}>Select frames to preview</p>}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs" style={{ color: 'var(--foreground)' }}>Speed (FPS)</p>
            <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{fps}</span>
          </div>
          <input type="range" min={1} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-full cursor-pointer accent-blue-500" />
        </div>
        <div className="space-y-2 mt-auto">
          <button onClick={handleOpenInEditor} disabled={frames.length === 0} className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}>
            Open in Editor →
          </button>
          <button onClick={handleExport} disabled={selectedIndices.length === 0 || exporting} className="w-full py-2 text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {exporting ? 'Exporting…' : `Export ${selectedIndices.length} Frame${selectedIndices.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AnimatePanel({ state, dispatch, onOpenInEditor }: AnimatePanelProps) {
  const sheet = state.spriteSheets.find((s) => s.id === state.selectedSheetId) ?? null;

  // Processing: API call in flight, no result yet
  if (state.isAnimating && !state.pendingVideoResult && !sheet) {
    return <ProcessingView state={state} dispatch={dispatch} />;
  }

  // Video result — ALWAYS shown after generation (primary + fallback paths both produce video)
  if (state.pendingVideoResult) {
    return <VideoResultView state={state} dispatch={dispatch} onOpenInEditor={onOpenInEditor} />;
  }

  // Sprite sheet from gallery navigation
  if (sheet) {
    return <SpriteSheetView state={state} dispatch={dispatch} onOpenInEditor={onOpenInEditor} />;
  }

  // Empty state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--muted)' }}>
        <svg className="w-7 h-7" style={{ color: 'var(--muted-foreground)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No animation yet</p>
      <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>Generate a sprite and animate it in the Review step</p>
      <div className="flex gap-3">
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}>Review & Animate</button>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>Generate Sprite</button>
      </div>
    </div>
  );
}
