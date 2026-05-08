'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import type { AppState, AppAction } from '@/types';
import { getDevicePixelRatio, setupPixelCanvas } from '@/lib/canvasPixel';
import { extractFrames } from '@/lib/spriteExtract';
import { applyChromaKey } from '@/lib/chromaKey';
import { Badge, Icon, GlowButton, SectionLabel, SpriteCraftLogo } from '@/components/Shared';

interface AnimatePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (file: File, options?: { fps?: number; cols?: number; resolution?: number }) => void;
  onOpenFramesInEditor?: (frames: string[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyChromaKeyToDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ctx = setupPixelCanvas(canvas, img.width, img.height, { pixelRatio: 1, applyStyles: false });
      ctx.drawImage(img, 0, 0, img.width, img.height);
      applyChromaKey(ctx, img.width, img.height, {
        targetColors: [[0, 255, 0]],
        tolerance: 35,
        erosion: 1,
        edgeSoftness: 2,
      });
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

// ── Processing state ──────────────────────────────────────────────────────────
function ProcessingView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'32px', animation:'fadeIn 0.3s ease', height: '100%' }}>
      <div style={{ position:'relative', width:'120px', height:'120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position:'absolute', top:0, left:0, animation:'spin 3s linear infinite' }}>
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="2"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="60 279" strokeLinecap="round"/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <SpriteCraftLogo size={48} />
        </div>
      </div>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'8px' }}>
        <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Animating Characters</div>
        <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)' }}>
          {state.animatingProgress} of {state.selectedForReview.length} complete — generating animation...
        </div>
      </div>
      <div style={{ width:'320px', display:'flex', flexDirection:'column', gap:'10px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', fontFamily:'var(--font-ui)', color:'var(--text2)' }}>
          <span>Stable Video Diffusion...</span>
          <span style={{ color:'var(--cyan)' }}>Processing</span>
        </div>
        <div style={{ height:'3px', background:'var(--bg5)', borderRadius:'2px', overflow:'hidden' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,var(--cyan2),var(--cyan),var(--purple))', borderRadius:'2px', width:`100%`, transition:'width 0.2s ease', boxShadow:'0 0 10px var(--cyan-glow)', animation: 'shimmer 2s infinite linear', backgroundSize: '200% 100%' }}/>
        </div>
      </div>
      
      <GlowButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })}>
        <Icon name="x" size={14}/> Cancel
      </GlowButton>
    </div>
  );
}

// ── Video Result — matches Step 3 reference screenshots ───────────────────────
function VideoResultView({
  state,
  dispatch,
  onOpenInEditor,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (file: File, options?: { fps?: number; cols?: number; resolution?: number }) => void;
}) {
  const pending = state.pendingVideoResult!;

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState(64);
  const [fps, setFps] = useState(12);
  const [cols, setCols] = useState(6);
  const [isOpening, setIsOpening] = useState(false);

  const handleDownloadVideo = useCallback(() => {
    const ext = pending.videoMimeType.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = `data:${pending.videoMimeType};base64,${pending.videoBase64}`;
    a.download = `${pending.animationName.replace(/\s+/g, '_')}_animation.${ext}`;
    a.click();
  }, [pending]);

  useEffect(() => {
    let url = '';
    fetch(`data:${pending.videoMimeType};base64,${pending.videoBase64}`)
      .then((r) => r.blob())
      .then((blob) => { url = URL.createObjectURL(blob); setVideoSrc(url); });
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.videoBase64]);

  const handleOpenInEditor = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      const blob = await fetch(`data:${pending.videoMimeType};base64,${pending.videoBase64}`).then((r) => r.blob());
      const ext = pending.videoMimeType.includes('webm') ? 'webm' : 'mp4';
      const file = new File([blob], `${pending.animationName.replace(/\s+/g, '_')}.${ext}`, { type: pending.videoMimeType });
      dispatch({ type: 'SET_PENDING_VIDEO', payload: null });
      onOpenInEditor(file, { fps, cols, resolution: frameSize });
    } finally {
      setIsOpening(false);
    }
  };
  const FRAME_SIZES = [16, 32, 48, 64, 128, 256];
  const FPS_OPTIONS = [8, 12, 24, 30];
  const COL_OPTIONS = [4, 6, 8];

  return (
    <div style={{ flex:1, display:'flex', gap:'24px', padding:'24px', minHeight: '100%', animation:'fadeIn 0.4s ease' }}>
      {/* Left: Video Preview */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'16px', overflowY: 'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {['Compose','Review','Export'].map((s,i) => (
            <React.Fragment key={s}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontFamily:'var(--font-ui)', fontWeight:700,
                  background: i === 2 ? 'var(--cyan)' : 'var(--bg4)',
                  color: i === 2 ? '#060810' : 'var(--text3)',
                  border: i === 2 ? 'none' : '1px solid var(--border)'
                }}>{i+1}</div>
                <span style={{ fontSize:'13px', color: i===2?'var(--text0)':'var(--text3)', fontFamily:'var(--font-ui)' }}>{s}</span>
              </div>
              {i < 2 && <div style={{ width:'24px', height:'1px', background:'var(--border)' }}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Export Animation</div>
            <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)', marginTop:'2px' }}>{pending.animationName}</div>
          </div>
          <Badge color="success">Ready</Badge>
        </div>

        <div style={{ background:'var(--bg2)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', padding:'20px', flex:1, display:'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', gap:'16px' }}>
          <div style={{ position: 'relative', width: '300px', height: '300px', backgroundColor: 'var(--bg0)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {videoSrc ? (
              <video src={videoSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <Icon name="play" size={32} color="var(--accent)" />
              </div>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
            Green-screen background — use &quot;Open in Editor&quot; to chroma key
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <GlowButton variant="ghost" onClick={handleDownloadVideo}>
              <Icon name="download" size={14}/> Download Raw Video
            </GlowButton>
            <GlowButton onClick={handleOpenInEditor} disabled={!videoSrc || isOpening}>
              {isOpening ? 'Opening...' : 'Open in Editor'}
            </GlowButton>
          </div>
        </div>
      </div>

      {/* Right: Export Options */}
      <div style={{ width:'300px', display:'flex', flexDirection:'column', gap:'16px', borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
        <div style={{ fontSize:'16px', fontWeight:700, color:'var(--text0)', letterSpacing: '-0.01em' }}>Editor Settings</div>
        
        <SectionLabel>Sprite Sheet Settings</SectionLabel>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Frame Size</div>
            <select value={frameSize} onChange={(e) => setFrameSize(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text0)', fontFamily: 'var(--font-ui)' }}>
              {FRAME_SIZES.map(s => <option key={s} value={s}>{s}×{s}px</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Frames per Second (FPS)</div>
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text0)', fontFamily: 'var(--font-ui)' }}>
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Grid Columns</div>
            <select value={cols} onChange={(e) => setCols(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text0)', fontFamily: 'var(--font-ui)' }}>
              {COL_OPTIONS.map(c => <option key={c} value={c}>{c} columns</option>)}
            </select>
          </div>
        </div>

        <div style={{ height:'1px', background:'var(--border)', margin: '8px 0' }}/>
        
        <GlowButton variant="ghost" onClick={() => { dispatch({ type: 'SET_PENDING_VIDEO', payload: null }); dispatch({ type: 'SET_VIEW', payload: 'review' }); }} style={{ width: '100%' }}>
          Start New Batch
        </GlowButton>
      </div>
    </div>
  );
}

// ── Sprite-sheet viewer (for Gallery → existing sprite sheets) ────────────────
function SpriteSheetView({
  state,
  onOpenInEditor,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenInEditor: (frames: string[]) => void;
}) {
  const sheet = state.spriteSheets.find((s) => s.id === state.selectedSheetId)!;

  const [frames, setFrames] = useState<string[]>([]);
  const [rawFrames, setRawFrames] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fps, setFps] = useState(12);
  const [removeGreen, setRemoveGreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const initTimer = setTimeout(() => {
      if (cancelled) return;
      setIsExtracting(true);
      setFrames([]);
      setSelectedIndices([]);
    }, 0);

    extractFrames(`data:${sheet.mimeType};base64,${sheet.imageBase64}`, sheet.cols, sheet.rows)
      .then(async (rawFrames) => {
        if (cancelled) return;
        setRawFrames(rawFrames);
        const processed = removeGreen
          ? await Promise.all(rawFrames.map(applyChromaKeyToDataUrl))
          : rawFrames;
        if (cancelled) return;
        setFrames(processed);
        setSelectedIndices(processed.map((_, i) => i));
        setIsExtracting(false);
      })
      .catch(() => { if (!cancelled) setIsExtracting(false); });

    return () => { cancelled = true; clearTimeout(initTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id, removeGreen]);

  useEffect(() => {
    if (selectedIndices.length === 0 || frames.length === 0 || !isPlaying) return;
    let idx = 0;
    const interval = setInterval(() => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const frameIdx = selectedIndices[idx % selectedIndices.length];
      const dataUrl = frames[frameIdx];
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const ctx = setupPixelCanvas(canvas, img.width, img.height, { pixelRatio: getDevicePixelRatio() });
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0, img.width, img.height);
      };
      img.src = dataUrl;
      idx++;
    }, Math.round(1000 / fps));
    return () => clearInterval(interval);
  }, [selectedIndices, frames, fps, isPlaying]);

  const toggleFrame = useCallback((i: number) => {
    setSelectedIndices((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b));
  }, []);

  const handleExport = async () => {
    if (selectedIndices.length === 0 || exporting) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const name = `${sheet.name}_${sheet.animationName}`.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
      const folder = zip.folder(name) ?? zip;
      selectedIndices.forEach((fi, i) => {
        folder.file(`frame_${String(i + 1).padStart(3, '0')}.png`, frames[fi].split(',')[1], { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${name}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const handleOpenInEditor = useCallback(() => {
    const sourceFrames = rawFrames.length > 0 ? rawFrames : frames;
    if (sourceFrames.length === 0) return;
    const framesToUse = selectedIndices.length > 0 ? selectedIndices.map((i) => sourceFrames[i]) : sourceFrames;
    onOpenInEditor(framesToUse);
  }, [rawFrames, frames, selectedIndices, onOpenInEditor]);

  return (
    <div style={{ flex:1, display:'flex', gap:'24px', padding:'24px', minHeight: '100%', animation:'fadeIn 0.4s ease' }}>
      {/* Left: Preview Grid */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'16px', overflowY: 'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Sprite Sheet Viewer</div>
            <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)', marginTop:'2px' }}>{sheet.animationName} — {sheet.name}</div>
          </div>
          <Badge color="cyan">Gallery Item</Badge>
        </div>

        <div style={{ background:'var(--bg2)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', padding:'20px', flex:1, display:'flex', flexDirection:'column', gap:'16px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setRemoveGreen((v) => !v)} className={`toggle-track${removeGreen ? ' on' : ''}`} style={{ width: '36px', height: '20px' }}>
                <div className="toggle-thumb" style={{ width: '14px', height: '14px' }} />
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text1)', fontFamily: 'var(--font-ui)' }}>Remove Green Background</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSelectedIndices(frames.map((_, i) => i))} style={{ fontSize: '12px', color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>Select All</button>
              <button onClick={() => setSelectedIndices([])} style={{ fontSize: '12px', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>Select None</button>
            </div>
          </div>
          
          {isExtracting ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
              <Icon name="sparkle" size={16} /> Extracting frames...
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${sheet.cols}, minmax(0, 1fr))`, gap:'8px' }}>
              {frames.map((frame, i) => {
                const isSelected = selectedIndices.includes(i);
                return (
                  <button key={i} onClick={() => toggleFrame(i)} style={{
                    aspectRatio:'1', borderRadius:'var(--r-sm)', background: isSelected ? 'var(--cyan-dim)' : 'var(--bg4)',
                    border:`1px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center',
                    animation:`frameAppear 0.3s ease both`, overflow:'hidden', position:'relative', cursor: 'pointer', transition: 'all 0.15s'
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frame} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                    {isSelected && <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'var(--cyan)', color: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold' }}>✓</div>}
                    <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: '9px', padding: '1px 3px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--text1)' }}>{i + 1}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions sidebar */}
      <div style={{ width:'300px', display:'flex', flexDirection:'column', gap:'16px', borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
        <div style={{ fontSize:'16px', fontWeight:700, color:'var(--text0)', letterSpacing: '-0.01em' }}>Sheet Options</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Preview</SectionLabel>
          {selectedIndices.length > 0 && (
            <button
              onClick={() => setIsPlaying((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--font-ui)', paddingBottom: 10 }}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={14} color="var(--cyan)" />
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          )}
        </div>
        <div style={{ aspectRatio: '1', borderRadius: 'var(--r-md)', backgroundColor: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {selectedIndices.length > 0 ? (
            <canvas ref={previewCanvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Select frames to preview</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text1)' }}>Speed</span>
          <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{fps} fps</span>
        </div>
        <input type="range" min={1} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--cyan)' }} />
        
        <div style={{ height:'1px', background:'var(--border)', margin: '8px 0' }}/>

        <GlowButton onClick={handleExport} disabled={selectedIndices.length === 0 || exporting} style={{ width: '100%' }}>
          {exporting ? 'Exporting...' : `Export ${selectedIndices.length} Frame(s) as ZIP`}
        </GlowButton>
        <GlowButton variant="secondary" onClick={handleOpenInEditor} disabled={frames.length === 0} style={{ width: '100%' }}>
          Open Video in Advanced Editor
        </GlowButton>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AnimatePanel({ state, dispatch, onOpenInEditor, onOpenFramesInEditor }: AnimatePanelProps) {
  const sheet = state.spriteSheets.find((s) => s.id === state.selectedSheetId) ?? null;

  if (state.isAnimating && !state.pendingVideoResult && !sheet) {
    return <ProcessingView state={state} dispatch={dispatch} />;
  }

  if (state.pendingVideoResult) {
    return <VideoResultView state={state} dispatch={dispatch} onOpenInEditor={onOpenInEditor} />;
  }

  if (sheet) {
    return <SpriteSheetView state={state} dispatch={dispatch} onOpenInEditor={onOpenFramesInEditor ?? (() => {})} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 32px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--text2)', background: 'var(--bg2)' }}>
        <Icon name="layers" size={24} />
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text0)', marginBottom: 8 }}>No Animation Yet</div>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, maxWidth: 260, lineHeight: 1.5 }}>
        Generate a sprite and animate it from the Review step to see results here.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <GlowButton onClick={() => dispatch({ type: 'SET_VIEW', payload: 'review' })}>Review &amp; Animate</GlowButton>
        <GlowButton variant="ghost" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })}>Generate Sprite</GlowButton>
      </div>
    </div>
  );
}
