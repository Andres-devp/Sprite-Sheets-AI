'use client';

import { useState } from 'react';
import type { AppState, AppAction, PendingVideoResult, Animation } from '@/types';

interface ReviewPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenSpritePicker: () => void;
}

const ANIMATION_TAGS = [
  'idle breathing', 'walk cycle', 'sword attack', 'jump',
  'run cycle', 'dance', 'hurt', 'death', 'cast spell', 'crouch',
];

const LABEL_TAGS = ['Idle', 'Walk Cycle', 'Run Cycle', 'Attack', 'Jump', 'Dance', 'Death', 'Cast Spell'];

// ── Sprite sheet image → WebM video (client-side, canvas + MediaRecorder) ─────
async function spriteSheetToVideoBlob(
  imageBase64: string,
  mimeType: string,
  cols: number,
  rows: number,
  fps = 12,
): Promise<{ blob: Blob; videoMimeType: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = `data:${mimeType};base64,${imageBase64}`;
  });

  const cellW = Math.floor(img.width / cols);
  const cellH = Math.floor(img.height / rows);
  const totalFrames = cols * rows;

  const canvas = document.createElement('canvas');
  canvas.width = cellW;
  canvas.height = cellH;
  const ctx = canvas.getContext('2d')!;

  const supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const videoMimeType = supported.split(';')[0];

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: supported });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: videoMimeType }), videoMimeType });
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.start();

    let frameIdx = 0;
    const drawNext = () => {
      if (frameIdx >= totalFrames) { recorder.stop(); return; }
      const col = frameIdx % cols;
      const row = Math.floor(frameIdx / cols);
      ctx.clearRect(0, 0, cellW, cellH);
      ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      frameIdx++;
      setTimeout(drawNext, 1000 / fps);
    };
    drawNext();
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ReviewPanel({ state, dispatch, onOpenSpritePicker }: ReviewPanelProps) {
  const [animationDesc, setAnimationDesc] = useState('');
  const [lockPerspective, setLockPerspective] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [animationLabel, setAnimationLabel] = useState('');

  const selectedSprites = state.sprites.filter((s) => state.selectedForReview.includes(s.id));

  const removeFromSelection = (id: string) => {
    dispatch({
      type: 'SET_SELECTED_FOR_REVIEW',
      payload: state.selectedForReview.filter((sid) => sid !== id),
    });
  };

  const handleAnimateClick = () => {
    if (!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating) return;
    const firstPart = animationDesc.trim().split(',')[0].trim();
    setAnimationLabel(firstPart.replace(/\b\w/g, (c) => c.toUpperCase()));
    setShowLabelModal(true);
  };

  const handleLabelSave = async () => {
    const label = animationLabel.trim();
    if (!label) return;
    setShowLabelModal(false);
    await startGeneration(label);
  };

  const startGeneration = async (label: string) => {
    dispatch({ type: 'SET_ANIMATING', payload: true });

    const results = await Promise.allSettled(
      selectedSprites.map(async (sprite) => {
        const res = await fetch('/api/animate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePrompt: sprite.prompt,
            animationName: animationDesc.trim(),
            artStyle: sprite.artStyle,
            cameraAngle: sprite.cameraAngle,
            spriteImageBase64: sprite.imageBase64,
            spriteMimeType: sprite.mimeType,
            sourceSeed: sprite.seed,
          }),
        });
        const data = await res.json() as {
          videoBase64?: string;
          videoMimeType?: string;
          imageBase64?: string;
          mimeType?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Generation failed');

        let pending: PendingVideoResult;

        if (data.videoBase64) {
          // Primary path: AI returned a real video
          pending = {
            videoBase64: data.videoBase64,
            videoMimeType: data.videoMimeType ?? 'video/mp4',
            animationName: label,
            spriteName: sprite.name,
            spriteImageBase64: sprite.imageBase64,
            spriteMimeType: sprite.mimeType,
          };
        } else if (data.imageBase64) {
          // Fallback path: API returned a sprite sheet image
          // Convert the sprite sheet to a video client-side so Step 3 always shows video
          const sheetCols = 4;
          const sheetRows = 4;
          const { blob, videoMimeType } = await spriteSheetToVideoBlob(
            data.imageBase64,
            data.mimeType ?? 'image/png',
            sheetCols,
            sheetRows,
            12,
          );
          const videoBase64 = await blobToBase64(blob);
          pending = {
            videoBase64,
            videoMimeType,
            animationName: label,
            spriteName: sprite.name,
            spriteImageBase64: sprite.imageBase64,
            spriteMimeType: sprite.mimeType,
            // Keep original sheet data for reliable "Extract All" extraction
            sheetImageBase64: data.imageBase64,
            sheetMimeType: data.mimeType ?? 'image/png',
            sheetCols,
            sheetRows,
          };
        } else {
          throw new Error('No image or video returned from server');
        }

        dispatch({ type: 'SET_PENDING_VIDEO', payload: pending });

        // Save animation to gallery (session-only)
        const animation: Animation = {
          id: crypto.randomUUID(),
          type: 'animation',
          name: sprite.name,
          animationName: label,
          imageBase64: sprite.imageBase64,
          mimeType: sprite.mimeType,
          videoBase64: pending.videoBase64,
          videoMimeType: pending.videoMimeType,
          artStyle: sprite.artStyle,
          cameraAngle: sprite.cameraAngle,
          createdAt: Date.now(),
        };
        dispatch({ type: 'ADD_ANIMATION', payload: animation });
      })
    );

    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      dispatch({ type: 'SET_ERROR', payload: failed[0].reason?.message ?? 'Generation failed' });
    } else {
      dispatch({ type: 'SET_ANIMATING', payload: false });
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Step header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[
            { num: 1, label: 'Character', done: true },
            { num: 2, label: 'Review & Animate', active: true },
            { num: 3, label: 'Animate', active: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-10 h-px bg-[#2a2a2a]" />}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.done ? 'bg-blue-600 text-white'
                      : step.active ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a2a] text-gray-500'
                  }`}
                >
                  {step.done ? '✓' : step.num}
                </div>
                <span className={`text-sm ${step.active ? 'text-white font-medium' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Review & Animate</h1>
        <p className="text-gray-400 text-sm mb-8">
          Select images to animate with a shared animation prompt.
        </p>

        {/* Selected sprites */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Images to Animate</p>
            <span className="text-xs text-gray-600">{selectedSprites.length} / 10</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {selectedSprites.map((sprite) => (
              <div key={sprite.id} className="flex flex-col items-center gap-1">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-[#00FF00] border-2 border-blue-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${sprite.mimeType};base64,${sprite.imageBase64}`}
                    alt={sprite.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeFromSelection(sprite.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 truncate w-24 text-center">{sprite.name}</p>
              </div>
            ))}
            {selectedSprites.length < 10 && (
              <button
                onClick={onOpenSpritePicker}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-[#2a2a2a] hover:border-blue-500/60 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs">Inventory</span>
              </button>
            )}
          </div>
          {selectedSprites.length === 0 && (
            <p className="text-xs text-gray-600 mt-2">
              No sprites selected.{' '}
              <button onClick={onOpenSpritePicker} className="text-blue-400 hover:underline">Pick from Gallery</button>
              {' '}or{' '}
              <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })} className="text-blue-400 hover:underline">
                generate one first
              </button>.
            </p>
          )}
        </div>

        {/* Animation description */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Animation Description <span className="normal-case text-gray-600">(shared for all images)</span>
          </p>
          <textarea
            value={animationDesc}
            onChange={(e) => setAnimationDesc(e.target.value)}
            placeholder="e.g. walking cycle, idle breathing, sword attack, jumping..."
            className="w-full h-28 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 transition-colors"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {ANIMATION_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setAnimationDesc(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  animationDesc === tag
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'border-[#2a2a2a] text-gray-500 hover:text-gray-200 hover:border-gray-500'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Lock perspective */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setLockPerspective((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${lockPerspective ? 'bg-blue-600' : 'bg-[#2a2a2a]'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${lockPerspective ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm text-gray-400">Lock Perspective</span>
        </div>

        {state.error && (
          <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleAnimateClick}
            disabled={!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {state.isAnimating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating animation (1–3 min, don&apos;t close tab…)
              </>
            ) : (
              `→ Animate ${selectedSprites.length} Image${selectedSprites.length !== 1 ? 's' : ''}`
            )}
          </button>
          <button
            onClick={() => {
              if (!animationDesc.trim() || selectedSprites.length === 0) return;
              setAnimationLabel(animationDesc.trim().split(',')[0].trim().replace(/\b\w/g, (c) => c.toUpperCase()));
              setShowLabelModal(true);
            }}
            disabled={!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Edit animation label"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Label Modal */}
      {showLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--card, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)' }}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground, #fff)' }}>Label This Animation</h2>
              <button onClick={() => setShowLabelModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors ml-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Name this animation in 1–3 words.</p>

            <input
              autoFocus
              type="text"
              value={animationLabel}
              onChange={(e) => setAnimationLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(); if (e.key === 'Escape') setShowLabelModal(false); }}
              placeholder="e.g. Run Cycle"
              className="w-full px-3 py-2 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: 'var(--background, #111)', border: '1px solid var(--border, #2a2a2a)', color: 'var(--foreground, #fff)' }}
            />

            <div className="flex flex-wrap gap-2 mb-5">
              {LABEL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setAnimationLabel(tag)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    animationLabel === tag
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'border-[#2a2a2a] text-gray-500 hover:text-gray-200 hover:border-gray-500'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleLabelSave}
                disabled={!animationLabel.trim()}
                className="px-5 py-2 bg-white hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 text-black text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
