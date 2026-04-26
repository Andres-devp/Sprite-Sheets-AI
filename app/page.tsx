'use client';

import { useReducer, useState, useEffect, useRef, useCallback } from 'react';
import type {
  AppState,
  AppAction,
  Sprite,
  SpriteSheet,
  Animation,
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
import Toaster from '@/components/Toaster';

const initialState: AppState = {
  currentView: 'video',
  sprites: [],
  spriteSheets: [],
  animations: [],
  selectedForReview: [],
  selectedSheetId: null,
  galleryFilter: 'all',
  isGenerating: false,
  isAnimating: false,
  error: null,
  pendingVideoResult: null,
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
        pendingVideoResult: null,
      };

    case 'ADD_ANIMATION':
      return {
        ...state,
        animations: [action.payload, ...state.animations].slice(0, 30),
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
        animations: state.animations.filter((a) => a.id !== action.payload),
        selectedForReview: state.selectedForReview.filter((id) => id !== action.payload),
        selectedSheetId:
          state.selectedSheetId === action.payload ? null : state.selectedSheetId,
      };

    case 'SET_PENDING_VIDEO':
      return {
        ...state,
        pendingVideoResult: action.payload,
        // If we got a result, stop animating spinner and navigate to animate view
        isAnimating: action.payload !== null ? false : state.isAnimating,
        currentView: action.payload !== null ? 'animate' : state.currentView,
        error: null,
      };

    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        sprites: action.payload.sprites,
        spriteSheets: action.payload.spriteSheets,
      };

    default:
      return state;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load persisted data after mount so SSR and initial client render match
  useEffect(() => {
    try {
      const raw = localStorage.getItem('spritesheet-v2');
      if (!raw) return;
      const saved = JSON.parse(raw) as { sprites?: Sprite[]; spriteSheets?: SpriteSheet[] };
      const sprites = saved.sprites ?? [];
      const spriteSheets = saved.spriteSheets ?? [];
      if (sprites.length > 0 || spriteSheets.length > 0) {
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: { sprites, spriteSheets } });
      }
    } catch { /* quota or parse error */ }
  }, []);

  const [chromaKeyTarget, setChromaKeyTarget] = useState<Sprite | null>(null);

  // Handoff: video file from AnimatePanel → VideoToSprite
  const [handoffVideoFile, setHandoffVideoFile] = useState<File | null>(null);

  // Video to Sprite controls — lifted so both VideoToSprite and VideoRightSidebar share them
  const [videoChroma, setVideoChroma] = useState<ChromaKeySettings>({
    targetColor: [0, 255, 0],
    tolerance: 8,
    erosion: 1,
    edgeSoftness: 0,
  });
  const [videoFps, setVideoFps] = useState(12);
  const [videoCols, setVideoCols] = useState(6);
  const [videoResolution, setVideoResolution] = useState(64);
  const [videoAutoCrop, setVideoAutoCrop] = useState(true);
  const [videoStats, setVideoStats] = useState({ total: 0, selected: 0 });
  const [videoPreviewFrames, setVideoPreviewFrames] = useState<string[]>([]);
  const [isVideoExporting, setIsVideoExporting] = useState(false);
  const videoRef = useRef<VideoToSpriteHandle>({} as VideoToSpriteHandle);

  const handleVideoStats = useCallback((total: number, selected: number) => {
    setVideoStats({ total, selected });
  }, []);

  const handlePreviewFrames = useCallback((frames: string[]) => {
    setVideoPreviewFrames(frames);
  }, []);

  const handleExportGrid = useCallback(async () => {
    setIsVideoExporting(true);
    try { await videoRef.current?.exportGrid(); } finally { setIsVideoExporting(false); }
  }, []);

  // Receive handoff video from AnimatePanel and navigate to video view
  const handleOpenInEditor = useCallback((file: File) => {
    setHandoffVideoFile(file);
    dispatch({ type: 'SET_VIEW', payload: 'video' });
  }, []);

  // Called by VideoToSprite after it starts loading the handoff file
  const handleHandoffLoaded = useCallback(() => {
    setHandoffVideoFile(null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'spritesheet-v2',
        JSON.stringify({ sprites: state.sprites, spriteSheets: state.spriteSheets })
      );
    } catch { /* quota */ }
  }, [state.sprites, state.spriteSheets]);

  const recentItems: GalleryItem[] = [
    ...state.sprites,
    ...state.spriteSheets,
    ...state.animations,
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);

  const handleRecentClick = useCallback((item: GalleryItem) => {
    if (item.type === 'sprite') {
      setChromaKeyTarget(item as Sprite);
    } else if (item.type === 'animation') {
      const anim = item as Animation;
      // Restore video result and navigate to animate view
      dispatch({
        type: 'SET_PENDING_VIDEO',
        payload: {
          videoBase64: anim.videoBase64,
          videoMimeType: anim.videoMimeType,
          animationName: anim.animationName,
          spriteName: anim.name,
          spriteImageBase64: anim.imageBase64,
          spriteMimeType: anim.mimeType,
        },
      });
    } else {
      dispatch({ type: 'SET_SELECTED_SHEET', payload: item.id });
      dispatch({ type: 'SET_VIEW', payload: 'animate' });
    }
  }, []);

  // Called by VideoToSprite when user exports a grid — saves to gallery
  const handleSpriteSheetSaved = useCallback(
    (base64: string, cols: number, rows: number, frameSize: number) => {
      dispatch({
        type: 'ADD_SPRITESHEET',
        payload: {
          id: crypto.randomUUID(),
          type: 'spritesheet',
          name: 'Video Export',
          animationName: 'Sprite Sheet',
          sourcePrompt: '',
          artStyle: '16bit',
          cameraAngle: 'front',
          imageBase64: base64,
          mimeType: 'image/png',
          cols,
          rows,
          frameSize,
          createdAt: Date.now(),
        },
      });
    },
    []
  );

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
              autoCrop={videoAutoCrop}
              onStatsChange={handleVideoStats}
              onPreviewFramesChange={handlePreviewFrames}
              onSpriteSheetSaved={handleSpriteSheetSaved}
              exportHandle={videoRef}
              initialVideoFile={handoffVideoFile}
              onInitialFileLoaded={handleHandoffLoaded}
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
            <AnimatePanel
              state={state}
              dispatch={dispatch}
              onOpenInEditor={handleOpenInEditor}
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
            autoCrop={videoAutoCrop}
            onAutoCropChange={setVideoAutoCrop}
            totalFrames={videoStats.total}
            selectedFrames={videoStats.selected}
            previewFrames={videoPreviewFrames}
            onExportGrid={handleExportGrid}
            isExporting={isVideoExporting}
            hasFrames={videoStats.total > 0}
          />
        )}
      </div>

      <Toaster />

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
