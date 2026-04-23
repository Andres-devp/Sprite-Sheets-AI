'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { Sprite, ChromaKeySettings } from '@/types';
import { applyChromaKey } from '@/lib/chromaKey';

interface ChromaKeyModalProps {
  sprite: Sprite;
  onClose: () => void;
  onAnimate?: () => void;
}

export default function ChromaKeyModal({ sprite, onClose, onAnimate }: ChromaKeyModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tolerance, setTolerance] = useState(30);
  const [erosion, setErosion] = useState(0);
  const [edgeSoftness, setEdgeSoftness] = useState(0);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      applyChromaKey(ctx, img.width, img.height, {
        targetColor: [0, 255, 0],
        tolerance,
        erosion,
        edgeSoftness,
      });
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageBase64}`;
  }, [sprite, tolerance, erosion, edgeSoftness]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.name.replace(/\s+/g, '-')}-no-bg.png`;
    a.click();
  };

  const handleProceed = () => {
    onAnimate?.();
  };

  const sliders = [
    { label: 'Tolerance', value: tolerance, setter: setTolerance, min: 0, max: 150 },
    { label: 'Erosion', value: erosion, setter: setErosion, min: 0, max: 20 },
    { label: 'Edge Softness', value: edgeSoftness, setter: setEdgeSoftness, min: 0, max: 20 },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Remove Background — {sprite.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Canvas preview */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4 checkerboard min-h-64">
            <canvas ref={canvasRef} className="max-w-full max-h-full rounded shadow-lg" />
          </div>

          {/* Controls panel */}
          <div className="w-56 flex-shrink-0 bg-[#161616] border-l border-[#2a2a2a] px-4 py-5 flex flex-col gap-5 overflow-y-auto">
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Chroma Color</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#00FF00] border border-[#444]" />
                <span className="text-xs text-gray-500">#00FF00</span>
              </div>
            </div>

            {sliders.map(({ label, value, setter, min, max }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-gray-400">{label}</p>
                  <span className="text-xs text-gray-600 font-mono">{value}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => setter(Number(e.target.value) as never)}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            ))}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <button
                onClick={handleDownload}
                className="w-full py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] text-gray-200 rounded-lg transition-colors"
              >
                Download PNG
              </button>
              <button
                onClick={handleProceed}
                className="w-full py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Proceed to Animate →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
