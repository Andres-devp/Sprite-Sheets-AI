'use client';

import { useState } from 'react';
import type { AppState, AppAction } from '@/types';

interface ReviewPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenSpritePicker: () => void;
}

const ANIMATION_TAGS = [
  'idle breathing',
  'walk cycle',
  'sword attack',
  'jump',
  'run cycle',
  'dance',
  'hurt',
  'death',
  'cast spell',
  'crouch',
];

export default function ReviewPanel({ state, dispatch, onOpenSpritePicker }: ReviewPanelProps) {
  const [animationDesc, setAnimationDesc] = useState('');
  const [lockPerspective, setLockPerspective] = useState(false);

  const selectedSprites = state.sprites.filter((s) => state.selectedForReview.includes(s.id));

  const removeFromSelection = (id: string) => {
    dispatch({
      type: 'SET_SELECTED_FOR_REVIEW',
      payload: state.selectedForReview.filter((sid) => sid !== id),
    });
  };

  const handleGenerate = async () => {
    if (!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating) return;

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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Generation failed');

        dispatch({
          type: 'ADD_SPRITESHEET',
          payload: {
            id: crypto.randomUUID(),
            type: 'spritesheet',
            name: sprite.name,
            animationName: animationDesc.trim(),
            sourcePrompt: sprite.prompt,
            artStyle: sprite.artStyle,
            cameraAngle: sprite.cameraAngle,
            imageBase64: data.imageBase64,
            mimeType: data.mimeType,
            cols: 4,
            rows: 4,
            frameSize: 256,
            createdAt: Date.now(),
          },
        });
      })
    );

    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      dispatch({ type: 'SET_ERROR', payload: failed[0].reason?.message ?? 'Some generations failed' });
    }
    // page.tsx reducer navigates to 'animate' on ADD_SPRITESHEET — no explicit SET_VIEW needed
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Step header */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {[
          { num: 1, label: 'Character', done: true },
          { num: 2, label: 'Review & Animate', active: true },
          { num: 3, label: 'Extract', active: false },
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
              <span className={`text-sm ${step.active ? 'text-white font-medium' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">Review & Animate</h1>
      <p className="text-gray-400 text-sm mb-8">
        Confirm your character and describe the animation to generate a sprite sheet.
      </p>

      {/* Selected sprites */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Character Sprites</p>
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

          {/* Add from gallery */}
          {selectedSprites.length < 10 && (
            <button
              onClick={onOpenSpritePicker}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-[#2a2a2a] hover:border-blue-500/60 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs">Gallery</span>
            </button>
          )}
        </div>

        {selectedSprites.length === 0 && (
          <p className="text-xs text-gray-600 mt-2">
            No sprites selected.{' '}
            <button onClick={onOpenSpritePicker} className="text-blue-400 hover:underline">
              Pick from Gallery
            </button>{' '}
            or{' '}
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })}
              className="text-blue-400 hover:underline"
            >
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

      {/* Lock perspective toggle */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setLockPerspective((v) => !v)}
          className={`w-10 h-5 rounded-full transition-colors ${lockPerspective ? 'bg-blue-600' : 'bg-[#2a2a2a]'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${lockPerspective ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-sm text-gray-400">Lock Perspective</span>
      </div>

      {/* Error */}
      {state.error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
          {state.error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {state.isAnimating ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating sprite sheet{selectedSprites.length > 1 ? 's' : ''}… (up to 45s)
          </>
        ) : (
          `Animate ${selectedSprites.length} Image${selectedSprites.length > 1 ? 's' : ''} →`
        )}
      </button>
    </div>
  );
}
