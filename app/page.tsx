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
  const videoRef = useRef<VideoToSpriteHandle>({} as VideoToSpriteHandle);

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
