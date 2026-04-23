'use client';

import { useState } from 'react';
import type { AppState, AppAction, ArtStyle, CameraAngle } from '@/types';

interface GeneratePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const ART_STYLES: { id: ArtStyle; label: string }[] = [
  { id: '8bit', label: '8-Bit Pixel' },
  { id: '16bit', label: '16-Bit Pixel' },
  { id: '32bit', label: '32-Bit Pixel' },
  { id: 'chibi', label: 'Chibi Anime' },
  { id: 'vector', label: 'Vector Flat' },
  { id: 'handdrawn', label: 'Hand-Drawn' },
];

const CAMERA_ANGLES: { id: CameraAngle; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'profile', label: 'Profile' },
  { id: 'three-quarter', label: '¾ Iso' },
  { id: 'topdown', label: 'Top-down' },
];

const QUICK_PROMPTS = ['Skeleton warrior', 'Pixel robot', 'Forest elf', 'Fire mage'];

export default function GeneratePanel({ state, dispatch }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<ArtStyle>('16bit');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('front');

  const handleGenerate = async () => {
    if (!prompt.trim() || state.isGenerating) return;

    dispatch({ type: 'SET_GENERATING', payload: true });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), artStyle, cameraAngle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');

      dispatch({
        type: 'ADD_SPRITE',
        payload: {
          id: crypto.randomUUID(),
          prompt: prompt.trim(),
          artStyle,
          cameraAngle,
          imageBase64: data.imageBase64,
          mimeType: data.mimeType,
          createdAt: Date.now(),
          name: prompt.trim().slice(0, 30),
        },
      });
    } catch (err: unknown) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Generation failed',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Step header */}
      <div className="mb-8">
        <div className="flex items-center gap-1 mb-6">
          {['1 Character', '2 Review', '3 Animate'].map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <div className="w-6 h-px bg-[#2a2a2a] mx-1" />}
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  i === 0
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 border border-[#2a2a2a]'
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-white">Create Your Character</h1>
        <p className="text-gray-400 text-sm mt-1">
          Describe your character and we&apos;ll generate a 4×4 sprite sheet ready for animation.
        </p>
      </div>

      {/* Prompt textarea */}
      <div className="mb-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
          placeholder="Describe your character in detail... e.g. 'A knight in rusty armor with a glowing sword'"
          className="w-full h-32 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 transition-colors"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => setPrompt(q)}
                className="text-xs px-3 py-1 rounded-full bg-[#2a2a2a] text-gray-400 hover:text-gray-100 hover:bg-[#333] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-600 flex-shrink-0 ml-2">{prompt.length}/500</span>
        </div>
      </div>

      {/* Art style */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Art Style</p>
        <div className="flex flex-wrap gap-2">
          {ART_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setArtStyle(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                artStyle === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-gray-100 border border-[#2a2a2a] hover:border-gray-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Camera angle */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Camera Angle</p>
        <div className="flex flex-wrap gap-2">
          {CAMERA_ANGLES.map((a) => (
            <button
              key={a.id}
              onClick={() => setCameraAngle(a.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                cameraAngle === a.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-gray-100 border border-[#2a2a2a] hover:border-gray-500'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
          {state.error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || state.isGenerating}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {state.isGenerating ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating sprite sheet… (may take up to 45s)
          </>
        ) : (
          'Generate Sprite Sheet'
        )}
      </button>
    </div>
  );
}
