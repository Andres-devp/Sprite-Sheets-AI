'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import type { AppState, AppAction } from '@/types';
import { extractFrames } from '@/lib/spriteExtract';
import { applyChromaKey } from '@/lib/chromaKey';

interface AnimatePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export default function AnimatePanel({ state, dispatch }: AnimatePanelProps) {
  const sheet = state.spriteSheets.find((s) => s.id === state.selectedSheetId) ?? null;

  const [frames, setFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fps, setFps] = useState(8);
  const [removeGreen, setRemoveGreen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Extract frames whenever sheet or removeGreen changes
  useEffect(() => {
    if (!sheet) {
      setFrames([]);
      setSelectedIndices([]);
      return;
    }

    let cancelled = false;
    setIsExtracting(true);
    setFrames([]);
    setSelectedIndices([]);

    extractFrames(
      `data:${sheet.mimeType};base64,${sheet.imageBase64}`,
      sheet.cols,
      sheet.rows
    )
      .then(async (rawFrames) => {
        if (cancelled) return;

        if (!removeGreen) {
          setFrames(rawFrames);
          setIsExtracting(false);
          return;
        }

        const processed = await Promise.all(
          rawFrames.map(
            (frameUrl) =>
              new Promise<string>((resolve) => {
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
                img.src = frameUrl;
              })
          )
        );

        if (cancelled) return;
        setFrames(processed);
        setIsExtracting(false);
      })
      .catch(() => {
        if (!cancelled) setIsExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sheet?.id, removeGreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation preview loop
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
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
      idx++;
    }, Math.round(1000 / fps));

    return () => clearInterval(interval);
  }, [selectedIndices, frames, fps]);

  const toggleFrame = useCallback((i: number) => {
    setSelectedIndices((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
    );
  }, []);

  const handleExport = async () => {
    if (!sheet || selectedIndices.length === 0 || exporting) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const folderName =
        `${sheet.name}_${sheet.animationName}`.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
      const folder = zip.folder(folderName) ?? zip;

      selectedIndices.forEach((frameIdx, i) => {
        const dataUrl = frames[frameIdx];
        const base64 = dataUrl.split(',')[1];
        folder.file(`frame_${String(i + 1).padStart(3, '0')}.png`, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!sheet) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium mb-1">No sprite sheet selected</p>
        <p className="text-gray-600 text-xs mb-4">
          Generate a sprite sheet first in the Sprite Sheet step
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Generate Sprite Sheet
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'gallery' })}
            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Open Gallery
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: frame grid */}
      <div className="flex-1 overflow-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            {[
              { num: 1, label: 'Character', done: true },
              { num: 2, label: 'Sprite Sheet', done: true },
              { num: 3, label: 'Animate', active: true },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-10 h-px bg-[#2a2a2a]" />}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.done
                        ? 'bg-blue-600 text-white'
                        : step.active
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2a2a2a] text-gray-500'
                    }`}
                  >
                    {step.done ? '✓' : step.num}
                  </div>
                  <span className={`text-sm ${'active' in step && step.active ? 'text-white font-medium' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Animate</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {sheet.name} — {sheet.animationName} — click frames to select
              </p>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })}
              className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Regenerate
            </button>
          </div>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => setRemoveGreen((v) => !v)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${removeGreen ? 'bg-blue-600' : 'bg-[#2a2a2a]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${removeGreen ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-xs text-gray-400">Remove green bg</span>
          </label>

          <button
            onClick={() => setSelectedIndices(frames.map((_, i) => i))}
            className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
            disabled={frames.length === 0}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedIndices([])}
            className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
            disabled={selectedIndices.length === 0}
          >
            Clear
          </button>
        </div>

        {/* Frame grid */}
        {isExtracting ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extracting {sheet.cols * sheet.rows} frames…
            </div>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${sheet.cols}, minmax(0, 1fr))` }}
          >
            {frames.map((frame, i) => {
              const isSelected = selectedIndices.includes(i);
              const selOrder = selectedIndices.indexOf(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleFrame(i)}
                  className={`relative aspect-square rounded-lg overflow-hidden checkerboard transition-all ${
                    isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#0a0a0a]'
                      : 'ring-1 ring-[#2a2a2a] hover:ring-gray-500'
                  }`}
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
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                      {selOrder + 1}
                    </div>
                  )}
                  <div className="absolute bottom-0.5 left-0.5 text-[9px] text-gray-600 bg-black/40 rounded px-0.5">
                    {i + 1}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: preview + controls */}
      <div className="w-64 flex-shrink-0 bg-[#111] border-l border-[#2a2a2a] px-4 py-6 flex flex-col gap-5 overflow-y-auto">

        {/* Reference sprite */}
        {(() => {
          const sourceSprite = state.sprites.find((s) => s.name === sheet.name);
          return sourceSprite ? (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Source Character</p>
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#00FF00]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${sourceSprite.mimeType};base64,${sourceSprite.imageBase64}`}
                  alt={sourceSprite.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : null;
        })()}

        {/* Animation preview */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">
            Preview {selectedIndices.length > 0 ? `(${selectedIndices.length} frames)` : ''}
          </p>
          <div className="aspect-square bg-[#0a0a0a] rounded-lg overflow-hidden checkerboard flex items-center justify-center">
            {selectedIndices.length > 0 ? (
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <p className="text-xs text-gray-600 text-center px-3">Select frames to preview</p>
            )}
          </div>
        </div>

        {/* FPS */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-gray-400">Speed (FPS)</p>
            <span className="text-xs text-gray-600 font-mono">{fps}</span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-700 mt-0.5">
            <span>1</span>
            <span>30</span>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          {selectedIndices.length} / {frames.length} frames selected
        </p>

        {/* Actions */}
        <div className="space-y-2 mt-auto">
          <button
            onClick={handleExport}
            disabled={selectedIndices.length === 0 || exporting}
            className="w-full py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {exporting
              ? 'Exporting…'
              : `Export ${selectedIndices.length} Frame${selectedIndices.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'gallery' })}
            className="w-full py-2 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded-lg transition-colors"
          >
            View Gallery
          </button>
        </div>
      </div>
    </div>
  );
}
