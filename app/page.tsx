'use client';

import { useReducer, useState, useEffect } from 'react';
import type { AppState, AppAction, Sprite, SpriteSheet, GalleryFilter } from '@/types';
import Sidebar from '@/components/Sidebar';
import GeneratePanel from '@/components/GeneratePanel';
import ReviewPanel from '@/components/ReviewPanel';
import Gallery from '@/components/Gallery';
import ChromaKeyModal from '@/components/ChromaKeyModal';

const initialState: AppState = {
  currentView: 'generate',
  sprites: [],
  spriteSheets: [],
  selectedForReview: [],
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
        currentView: 'gallery',
      };
    case 'ADD_SPRITESHEET':
      return {
        ...state,
        spriteSheets: [action.payload, ...state.spriteSheets].slice(0, 30),
        isAnimating: false,
        error: null,
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
    case 'SET_GALLERY_FILTER':
      return { ...state, galleryFilter: action.payload };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload, error: null };
    case 'SET_ANIMATING':
      return { ...state, isAnimating: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isGenerating: false, isAnimating: false };
    case 'DELETE_ITEM': {
      return {
        ...state,
        sprites: state.sprites.filter((s) => s.id !== action.payload),
        spriteSheets: state.spriteSheets.filter((ss) => ss.id !== action.payload),
        selectedForReview: state.selectedForReview.filter((id) => id !== action.payload),
      };
    }
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
    return {
      ...init,
      sprites: saved.sprites ?? [],
      spriteSheets: saved.spriteSheets ?? [],
    };
  } catch {
    return init;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState, loadInitialState);
  const [chromaKeyTarget, setChromaKeyTarget] = useState<Sprite | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        'spritesheet-v2',
        JSON.stringify({ sprites: state.sprites, spriteSheets: state.spriteSheets })
      );
    } catch {
      /* quota exceeded */
    }
  }, [state.sprites, state.spriteSheets]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar
        currentView={state.currentView}
        sprites={state.sprites}
        spriteSheets={state.spriteSheets}
        onNavigate={(view) => dispatch({ type: 'SET_VIEW', payload: view })}
      />

      <main className="flex-1 overflow-auto">
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

      {chromaKeyTarget && (
        <ChromaKeyModal
          sprite={chromaKeyTarget}
          onClose={() => setChromaKeyTarget(null)}
        />
      )}
    </div>
  );
}
