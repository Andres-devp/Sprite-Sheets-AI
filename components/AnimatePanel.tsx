'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { AppState, AppAction } from '@/types';
import { extractFrames } from '@/lib/spriteExtract';
import { applyChromaKey } from '@/lib/chromaKey';
import ExportModal from '@/components/ExportModal';

interface AnimatePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export default function AnimatePanel({ state, dispatch }: AnimatePanelProps) {
  const { selectedSprite, chromaKeySettings, selectedFrames } = state;
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(8);
  const [showExport, setShowExport] = useState(false);

  const frames = useMemo(() => selectedSprite?.frames ?? [], [selectedSprite?.frames]);
  // Loading is derived: true when a sprite is selected but its frames haven't been extracted yet
  const loading = !!selectedSprite && !selectedSprite.frames;

  // Extract and process frames when sprite is selected and frames not yet cached
  useEffect(() => {
    if (!selectedSprite || selectedSprite.frames) return;

    const src = `data:${selectedSprite.mimeType};base64,${selectedSprite.imageBase64}`;
    extractFrames(src, 4, 4)
      .then((rawFrames) => {
        return Promise.all(
          rawFrames.map(
            (frameDataUrl) =>
              new Promise<string>((resolve) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  applyChromaKey(ctx, img.width, img.height, chromaKeySettings);
                  resolve(canvas.toDataURL('image/png'));
                };
                img.src = frameDataUrl;
              })
          )
        );
      })
      .then((processed) => {
        dispatch({
          type: 'UPDATE_SPRITE_FRAMES',
          payload: { id: selectedSprite.id, frames: processed },
        });
      })
      .catch((err: Error) => dispatch({ type: 'SET_ERROR', payload: err.message }));
  }, [selectedSprite?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop
  useEffect(() => {
    if (!frames.length || !selectedFrames.length) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let idx = 0;
    const interval = setInterval(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dataUrl = frames[selectedFrames[idx % selectedFrames.length]];
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = dataUrl;
      idx++;
    }, Math.round(1000 / fps));

    return () => clearInterval(interval);
  }, [frames, selectedFrames, fps]);

  const toggleFrame = useCallback(
    (i: number) => {
      const next = selectedFrames.includes(i)
        ? selectedFrames.filter((f) => f !== i)
        : [...selectedFrames, i];
      dispatch({ type: 'SET_FRAMES', payload: next });
    },
    [selectedFrames, dispatch]
  );

  if (!selectedSprite) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium mb-1">No sprite selected</p>
        <p className="text-gray-600 text-xs">Open a sprite from Gallery and click &ldquo;Proceed to Animate&rdquo;</p>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'gallery' })}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go to Gallery
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Frame grid */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Animate & Export</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedSprite.name} — click frames to add to animation
            </p>
          </div>
          {selectedFrames.length > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Export {selectedFrames.length} Frame{selectedFrames.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extracting and processing 16 frames…
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {frames.map((frame, i) => (
              <button
                key={i}
                onClick={() => toggleFrame(i)}
                className={`aspect-square rounded-lg overflow-hidden checkerboard transition-all ${
                  selectedFrames.includes(i)
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0a0a0a] scale-[1.02]'
                    : 'ring-1 ring-[#2a2a2a] hover:ring-gray-500'
                }`}
                title={`Frame ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame}
                  alt={`Frame ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="w-64 flex-shrink-0 bg-[#111] border-l border-[#2a2a2a] px-4 py-6 flex flex-col gap-5 overflow-y-auto">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3">Animation Preview</p>
          <div className="aspect-square bg-[#0a0a0a] rounded-lg overflow-hidden checkerboard flex items-center justify-center">
            {selectedFrames.length > 0 ? (
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <p className="text-xs text-gray-600 text-center px-3">
                Select frames below to preview
              </p>
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
          {selectedFrames.length} / {frames.length} frames selected
        </p>

        <div className="space-y-2 mt-auto">
          {selectedFrames.length > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="w-full py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Export {selectedFrames.length} Frame{selectedFrames.length !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'SET_FRAMES', payload: [] })}
            disabled={selectedFrames.length === 0}
            className="w-full py-2 text-xs bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 rounded-lg transition-colors"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {showExport && (
        <ExportModal
          frames={frames}
          selectedFrameIndices={selectedFrames}
          defaultFilename={selectedSprite.name.replace(/\s+/g, '-').toLowerCase()}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
