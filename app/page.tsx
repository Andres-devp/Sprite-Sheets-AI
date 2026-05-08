'use client';

import { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import type { AppState, AppAction, Sprite, Animation, ChromaKeySettings, GalleryItem } from '@/types';
import Sidebar from '@/components/Sidebar';
import GeneratePanel from '@/components/GeneratePanel';
import ReviewPanel from '@/components/ReviewPanel';
import AnimatePanel from '@/components/AnimatePanel';
import Gallery from '@/components/Gallery';
import AccountPanel from '@/components/AccountPanel';
import ChromaKeyModal from '@/components/ChromaKeyModal';
import VideoToSprite, { type VideoToSpriteHandle } from '@/components/VideoToSprite';
import VideoRightSidebar from '@/components/VideoRightSidebar';
import Toaster from '@/components/Toaster';
import { Badge, Icon } from '@/components/Shared';

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
  animatingProgress: 0,
  error: null,
  pendingVideoResult: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, currentView: action.payload, error: null };
    case 'ADD_SPRITE': return { ...state, sprites: [action.payload, ...state.sprites].slice(0, 30), isGenerating: false, error: null, selectedForReview: [action.payload.id], currentView: 'review' };
    case 'ADD_SPRITESHEET': return { ...state, spriteSheets: [action.payload, ...state.spriteSheets].slice(0, 30), isAnimating: false, error: null, selectedSheetId: action.payload.id, currentView: 'animate', pendingVideoResult: null };
    case 'ADD_SPRITESHEET_NO_NAV': return { ...state, spriteSheets: [action.payload, ...state.spriteSheets].slice(0, 30), isAnimating: false, error: null, selectedSheetId: action.payload.id, pendingVideoResult: null };
    case 'ADD_ANIMATION': return { ...state, animations: [action.payload, ...state.animations].slice(0, 30) };
    case 'UPDATE_SPRITESHEET_FRAMES': return { ...state, spriteSheets: state.spriteSheets.map((ss) => ss.id === action.payload.id ? { ...ss, frames: action.payload.frames } : ss ) };
    case 'SET_SELECTED_FOR_REVIEW': return { ...state, selectedForReview: action.payload };
    case 'SET_SELECTED_SHEET': return { ...state, selectedSheetId: action.payload };
    case 'SET_GALLERY_FILTER': return { ...state, galleryFilter: action.payload };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload, error: null };
    case 'SET_ANIMATING': return { ...state, isAnimating: action.payload, animatingProgress: 0, error: null };
    case 'SET_ANIMATING_PROGRESS': return { ...state, animatingProgress: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload, isGenerating: false, isAnimating: false };
    case 'DELETE_ITEM': return { ...state, sprites: state.sprites.filter((s) => s.id !== action.payload), spriteSheets: state.spriteSheets.filter((ss) => ss.id !== action.payload), animations: state.animations.filter((a) => a.id !== action.payload), selectedForReview: state.selectedForReview.filter((id) => id !== action.payload), selectedSheetId: state.selectedSheetId === action.payload ? null : state.selectedSheetId };
    case 'SET_PENDING_VIDEO': return { ...state, pendingVideoResult: action.payload, isAnimating: action.payload !== null ? false : state.isAnimating, currentView: action.payload !== null ? 'animate' : state.currentView, error: null };
    case 'LOAD_FROM_STORAGE': return { ...state, sprites: action.payload.sprites, spriteSheets: action.payload.spriteSheets };
    default: return state;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('spritesheet-v2');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.sprites?.length || saved.spriteSheets?.length) {
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: { sprites: saved.sprites || [], spriteSheets: saved.spriteSheets || [] } });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('spritesheet-v2', JSON.stringify({ sprites: state.sprites, spriteSheets: state.spriteSheets }));
    } catch {}
  }, [state.sprites, state.spriteSheets]);

  const [chromaKeyTarget, setChromaKeyTarget] = useState<Sprite | null>(null);
  const [handoffVideoFile, setHandoffVideoFile] = useState<File | null>(null);
  const [handoffVideoFrames, setHandoffVideoFrames] = useState<string[] | null>(null);

  const [videoChroma, setVideoChroma] = useState<ChromaKeySettings>({ targetColors: [[0, 255, 0]], tolerance: 8, erosion: 1, edgeSoftness: 0 });
  const [videoFps, setVideoFps] = useState(12);
  const [videoCols, setVideoCols] = useState(6);
  const [videoResolution, setVideoResolution] = useState(64);
  const [videoAutoCrop, setVideoAutoCrop] = useState(true);
  const [videoStats, setVideoStats] = useState({ total: 0, selected: 0 });
  const [videoPreviewFrames, setVideoPreviewFrames] = useState<string[]>([]);
  const [isVideoExporting, setIsVideoExporting] = useState(false);
  const videoRef = useRef<VideoToSpriteHandle>({} as VideoToSpriteHandle);

  const handleVideoStatsChange = useCallback((total: number, selected: number) => {
    setVideoStats({ total, selected });
  }, []);

  const recentItems = [...state.sprites, ...state.spriteSheets, ...state.animations].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);

  const handleRecentClick = useCallback((item: GalleryItem) => {
    if (item.type === 'sprite') setChromaKeyTarget(item as Sprite);
    else if (item.type === 'animation') {
      const anim = item as Animation;
      dispatch({ type: 'SET_PENDING_VIDEO', payload: { videoBase64: anim.videoBase64, videoMimeType: anim.videoMimeType, animationName: anim.animationName, spriteName: anim.name, spriteImageBase64: anim.imageBase64, spriteMimeType: anim.mimeType } });
    }
    else { dispatch({ type: 'SET_SELECTED_SHEET', payload: item.id }); dispatch({ type: 'SET_VIEW', payload: 'animate' }); }
  }, []);

  const activeNav = state.currentView === 'review' || state.currentView === 'animate' ? 'generate' : state.currentView;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      fontFamily: 'var(--font-ui)', overflow: 'hidden'
    }}>
      <Sidebar
        currentView={state.currentView}
        onNavigate={(view) => dispatch({ type: 'SET_VIEW', payload: view })}
        recentItems={recentItems}
        onRecentClick={handleRecentClick}
      />

      {/* ── Main Content ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
        {/* Topbar */}
        <div style={{
          height:'48px', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', borderBottom:'1px solid var(--border)',
          background: 'var(--bg1)',
          flexShrink:0
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'16px', fontWeight:600, color:'var(--text0)', letterSpacing:'-0.01em' }}>
              {activeNav === 'generate' ? 'AI Generator' : activeNav === 'video' ? 'Video → Sprite Sheet' : activeNav === 'account' ? 'Account' : 'Gallery'}
            </span>
            {activeNav === 'generate' && <Badge color="cyan">Beta</Badge>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 12px', borderRadius:'var(--r-sm)', background:'var(--bg3)', border:'1px solid var(--border)' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 6px var(--success)' }}/>
              <span style={{ fontSize:'13px', fontFamily:'var(--font-ui)', color:'var(--text2)', whiteSpace:'nowrap' }}>Pro Plan</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', borderRadius:'var(--r-sm)', background:'var(--cyan-dim)', border:'1px solid var(--border2)' }}>
              <Icon name="sparkle" size={12} color="var(--cyan)"/>
              <span style={{ fontSize:'13px', fontFamily:'var(--font-ui)', color:'var(--cyan)', fontWeight:600 }}>3 credits</span>
            </div>
          </div>
        </div>

        {/* Flow content */}
        <div style={{ flex:1, display:'flex', overflowX:'hidden', overflowY:'hidden', background:'var(--bg0)', minHeight: 0 }}>
          {state.currentView === 'video' && (
            <div className="flex flex-col xl:flex-row gap-4 w-full h-full p-6 overflow-y-auto">
              <div className="flex-1 shadow-sm p-0 flex flex-col min-h-[500px]" style={{ borderRadius: 'var(--r-lg)', background: 'var(--bg1)', border: '1px solid var(--border)' }}>
                  <VideoToSprite
                  chromaSettings={videoChroma} fps={videoFps} cols={videoCols} resolution={videoResolution} autoCrop={videoAutoCrop}
                    onStatsChange={handleVideoStatsChange}
                    onPreviewFramesChange={setVideoPreviewFrames}
                    exportHandle={videoRef}
                    initialVideoFile={handoffVideoFile}
                  onInitialFileLoaded={() => setHandoffVideoFile(null)}
                  initialFrames={handoffVideoFrames}
                  onInitialFramesLoaded={() => setHandoffVideoFrames(null)}
                  onSpriteSheetSaved={(b, c, r, f) => dispatch({ type: 'ADD_SPRITESHEET_NO_NAV', payload: { id: crypto.randomUUID(), type: 'spritesheet', name: 'Export', animationName: 'Sheet', sourcePrompt: '', artStyle: '16bit', cameraAngle: 'front', imageBase64: b, mimeType: 'image/png', cols: c, rows: r, frameSize: f, createdAt: Date.now() }})}
                />
              </div>
              <aside className="w-full xl:w-[400px] flex-shrink-0 flex flex-col min-h-[500px]" style={{ borderRadius: 'var(--r-lg)', background: 'var(--bg1)', border: '1px solid var(--border)' }}>
                <VideoRightSidebar
                  chromaSettings={videoChroma} onChromaChange={setVideoChroma}
                  fps={videoFps} onFpsChange={setVideoFps}
                  cols={videoCols} onColsChange={setVideoCols}
                  resolution={videoResolution} onResolutionChange={setVideoResolution}
                  autoCrop={videoAutoCrop} onAutoCropChange={setVideoAutoCrop}
                  totalFrames={videoStats.total} selectedFrames={videoStats.selected}
                  previewFrames={videoPreviewFrames}
                  onExportGrid={async () => { setIsVideoExporting(true); try { await videoRef.current?.exportGrid(); } finally { setIsVideoExporting(false); } }}
                  isExporting={isVideoExporting} hasFrames={videoStats.total > 0}
                />
              </aside>
            </div>
          )}
          
          {state.currentView === 'generate' && <div className="h-full w-full" style={{ padding: '0px' }}><GeneratePanel state={state} dispatch={dispatch} /></div>}
          {state.currentView === 'review' && <div className="h-full w-full" style={{ padding: '0px' }}><ReviewPanel state={state} dispatch={dispatch} onOpenSpritePicker={() => { dispatch({ type: 'SET_GALLERY_FILTER', payload: 'sprites' }); dispatch({ type: 'SET_VIEW', payload: 'gallery' }); }} onPreviewSprite={setChromaKeyTarget} /></div>}
          {state.currentView === 'animate' && (
            <div className="h-full w-full" style={{ padding: '0px' }}>
              <AnimatePanel
                state={state}
                dispatch={dispatch}
                onOpenInEditor={(f, options) => {
                  if (typeof options?.fps === 'number') setVideoFps(options.fps);
                  if (typeof options?.cols === 'number') setVideoCols(options.cols);
                  if (typeof options?.resolution === 'number') setVideoResolution(options.resolution);
                  setHandoffVideoFile(f);
                  dispatch({ type: 'SET_VIEW', payload: 'video' });
                }}
                onOpenFramesInEditor={(frames) => {
                  setHandoffVideoFrames(frames);
                  dispatch({ type: 'SET_VIEW', payload: 'video' });
                }}
              />
            </div>
          )}
          {state.currentView === 'gallery' && <div className="h-full w-full overflow-hidden p-0" style={{ padding: '0px' }}><Gallery state={state} dispatch={dispatch} onRemoveBg={setChromaKeyTarget} onSelectForReview={(ids) => { dispatch({ type: 'SET_SELECTED_FOR_REVIEW', payload: ids }); dispatch({ type: 'SET_VIEW', payload: 'review' }); }} /></div>}
          {state.currentView === 'account' && <div className="h-full w-full" style={{ padding: '0px' }}><AccountPanel state={state} dispatch={dispatch} /></div>}
        </div>
      </div>

      <Toaster />
      {chromaKeyTarget && <ChromaKeyModal sprite={chromaKeyTarget} onClose={() => setChromaKeyTarget(null)} onAnimate={() => { dispatch({ type: 'SET_SELECTED_FOR_REVIEW', payload: [chromaKeyTarget.id] }); setChromaKeyTarget(null); dispatch({ type: 'SET_VIEW', payload: 'review' }); }} />}
    </div>
  );
}
