'use client';

import React, { useState } from 'react';
import type { AppState, AppAction, PendingVideoResult, Animation, Sprite } from '@/types';
import { setupPixelCanvas } from '@/lib/canvasPixel';
import { Badge, Icon, GlowButton, SectionLabel } from '@/components/Shared';

interface ReviewPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenSpritePicker: () => void;
  onPreviewSprite?: (sprite: Sprite) => void;
}

const ANIMATION_TAGS = [
  'idle breathing', 'walk cycle', 'sword attack', 'jump',
  'run cycle', 'dance', 'hurt', 'death', 'cast spell', 'crouch',
];

const LABEL_TAGS = ['Idle', 'Walk Cycle', 'Run Cycle', 'Attack', 'Jump', 'Dance', 'Death', 'Cast Spell'];

// ── Sprite sheet → WebM (client-side) ────────────────────────────────────────
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
  const ctx = setupPixelCanvas(canvas, cellW, cellH, { pixelRatio: 1, applyStyles: false });
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

async function upscaleBase64(base64: string, mimeType: string, targetSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      resolve(canvas.toDataURL(mimeType).split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

export default function ReviewPanel({ state, dispatch, onOpenSpritePicker, onPreviewSprite }: ReviewPanelProps) {
  const [animationDesc, setAnimationDesc] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [animationLabel, setAnimationLabel] = useState('');

  const selectedSprites = state.sprites.filter((s) => state.selectedForReview.includes(s.id));

  const removeFromSelection = (id: string) => {
    dispatch({ type: 'SET_SELECTED_FOR_REVIEW', payload: state.selectedForReview.filter((sid) => sid !== id) });
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
    dispatch({ type: 'SET_PENDING_VIDEO', payload: null });
    dispatch({ type: 'SET_VIEW', payload: 'animate' });
    dispatch({ type: 'SET_ANIMATING', payload: true });
    let completed = 0;

    const results = await Promise.allSettled(
      selectedSprites.map(async (sprite) => {
        const upscaledBase64 = await upscaleBase64(sprite.imageBase64, sprite.mimeType, 512);
        const hfKey = localStorage.getItem('hf-api-key') ?? '';
        const res = await fetch('/api/animate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(hfKey ? { 'X-HF-Token': hfKey } : {}) },
          body: JSON.stringify({
            sourcePrompt: sprite.prompt,
            animationName: animationDesc.trim(),
            artStyle: sprite.artStyle,
            cameraAngle: sprite.cameraAngle,
            spriteImageBase64: upscaledBase64,
            spriteMimeType: sprite.mimeType,
            sourceSeed: sprite.seed,
          }),
        });
        const data = await res.json() as {
          videoBase64?: string; videoMimeType?: string;
          imageBase64?: string; mimeType?: string; error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Generation failed');

        let pending: PendingVideoResult;
        if (data.videoBase64) {
          pending = {
            videoBase64: data.videoBase64,
            videoMimeType: data.videoMimeType ?? 'video/mp4',
            animationName: label,
            spriteName: sprite.name,
            spriteImageBase64: sprite.imageBase64,
            spriteMimeType: sprite.mimeType,
          };
        } else if (data.imageBase64) {
          const sheetCols = 4; const sheetRows = 4;
          const { blob, videoMimeType } = await spriteSheetToVideoBlob(
            data.imageBase64, data.mimeType ?? 'image/png', sheetCols, sheetRows, 12,
          );
          const videoBase64 = await blobToBase64(blob);
          pending = {
            videoBase64, videoMimeType, animationName: label,
            spriteName: sprite.name,
            spriteImageBase64: sprite.imageBase64, spriteMimeType: sprite.mimeType,
            sheetImageBase64: data.imageBase64, sheetMimeType: data.mimeType ?? 'image/png',
            sheetCols, sheetRows,
          };
        } else {
          throw new Error('No image or video returned from server');
        }

        completed++;
        dispatch({ type: 'SET_ANIMATING_PROGRESS', payload: completed });
        dispatch({ type: 'SET_PENDING_VIDEO', payload: pending });
        const animation: Animation = {
          id: crypto.randomUUID(), type: 'animation',
          name: sprite.name, animationName: label,
          imageBase64: sprite.imageBase64, mimeType: sprite.mimeType,
          videoBase64: pending.videoBase64, videoMimeType: pending.videoMimeType,
          artStyle: sprite.artStyle, cameraAngle: sprite.cameraAngle,
          createdAt: Date.now(),
        };
        dispatch({ type: 'ADD_ANIMATION', payload: animation });
      })
    );

    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    if (failed.length > 0) {
      dispatch({ type: 'SET_ERROR', payload: failed[0].reason?.message ?? 'Generation failed' });
      if (succeeded.length === 0) {
        dispatch({ type: 'SET_VIEW', payload: 'review' });
      }
    } else {
      dispatch({ type: 'SET_ANIMATING', payload: false });
    }
  };

  return (
    <div style={{ flex:1, display:'flex', gap:'24px', padding:'24px', minHeight: '100%', animation:'fadeIn 0.4s ease' }}>
      {/* Left: Preview Grid */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'16px', overflowY: 'auto' }}>
        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {['Compose','Review','Export'].map((s,i) => (
            <React.Fragment key={s}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontFamily:'var(--font-ui)', fontWeight:700,
                  background: i === 1 ? 'var(--cyan)' : 'var(--bg4)',
                  color: i === 1 ? '#060810' : 'var(--text3)',
                  border: i === 1 ? 'none' : '1px solid var(--border)'
                }}>{i+1}</div>
                <span style={{ fontSize:'13px', color: i===1?'var(--text0)':'var(--text3)', fontFamily:'var(--font-ui)' }}>{s}</span>
              </div>
              {i < 2 && <div style={{ width:'24px', height:'1px', background:'var(--border)' }}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Selected Sprites</div>
            <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)', marginTop:'2px' }}>{selectedSprites.length} selected for animation</div>
          </div>
          <Badge color="success">Ready</Badge>
        </div>

        {/* Selected sprites grid */}
        <div style={{ background:'var(--bg2)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', padding:'20px', flex:1, display:'flex', flexDirection:'column', gap:'16px', overflowY: 'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:'12px' }}>
            {selectedSprites.map((sprite) => (
              <div key={sprite.id} style={{
                aspectRatio:'1', borderRadius:'var(--r-sm)', background:`var(--bg4)`,
                border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
                animation:`frameAppear 0.3s ease both`, overflow:'hidden', position:'relative'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${sprite.mimeType};base64,${sprite.imageBase64}`}
                  alt={sprite.name}
                  onClick={() => onPreviewSprite?.(sprite)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: onPreviewSprite ? 'zoom-in' : 'default' }}
                />
                <button
                  onClick={() => removeFromSelection(sprite.id)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 24, height: 24, borderRadius: 'var(--r-sm)',
                    backgroundColor: 'rgba(7,8,12,0.85)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--destructive)'; e.currentTarget.style.borderColor = 'var(--destructive)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(7,8,12,0.85)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            
            {/* Add more button */}
            {selectedSprites.length < 10 && (
              <button
                onClick={onOpenSpritePicker}
                style={{
                  aspectRatio:'1', borderRadius:'var(--r-sm)', border:'1px dashed var(--border)',
                  backgroundColor:'transparent', display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:'6px', cursor:'pointer',
                  color:'var(--muted-foreground)', transition:'all 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--cyan)';
                  e.currentTarget.style.color = 'var(--cyan)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                }}
              >
                <Icon name="plus" size={20} />
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)' }}>Add Sprite</span>
              </button>
            )}
          </div>
          
          {selectedSprites.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
              No sprites selected. Pick one from the gallery to animate.
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions sidebar */}
      <div style={{ width:'300px', display:'flex', flexDirection:'column', gap:'16px', borderLeft: '1px solid var(--border)', paddingLeft: '24px', overflowY: 'auto' }}>
        <div style={{ fontSize:'16px', fontWeight:700, color:'var(--text0)', letterSpacing: '-0.01em' }}>Animation Options</div>
        
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <SectionLabel>Action Description</SectionLabel>
          <div style={{ position:'relative' }}>
            <textarea
              value={animationDesc}
              onChange={e => setAnimationDesc(e.target.value)}
              placeholder="e.g. walking cycle, sword attack..."
              style={{
                width:'100%', minHeight:'100px', padding:'12px', resize:'vertical',
                background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)',
                color:'var(--text0)', fontSize:'13px', fontFamily:'var(--font-ui)', lineHeight:1.6,
                outline:'none', transition:'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor='var(--cyan)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop: '4px' }}>
            {ANIMATION_TAGS.slice(0, 6).map(s => (
              <button key={s} onClick={() => setAnimationDesc(s)}
                style={{ padding:'4px 8px', borderRadius:'var(--r-sm)', border:`1px solid ${animationDesc === s ? 'var(--cyan)' : 'var(--border)'}`, background: animationDesc === s ? 'var(--cyan-dim)' : 'var(--bg3)', color: animationDesc === s ? 'var(--cyan)' : 'var(--text2)', fontSize:'12px', fontFamily:'var(--font-ui)', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { if (animationDesc !== s) { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--text1)'; } }}
                onMouseLeave={e => { if (animationDesc !== s) { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)'; } }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height:'1px', background:'var(--border)', margin: '8px 0' }}/>

        {/* Error */}
        {state.error && (
          <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--danger) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius: 'var(--r-sm)', color: 'var(--danger)', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
            {state.error}
          </div>
        )}

        <GlowButton onClick={handleAnimateClick} disabled={!animationDesc.trim() || selectedSprites.length === 0 || state.isAnimating} size="lg" style={{ width: '100%', marginTop: '8px' }}>
          {state.isAnimating ? (
            <><Icon name="sparkle" size={16}/> Generating...</>
          ) : (
            <><Icon name="layers" size={16}/> Animate Sprites</>
          )}
        </GlowButton>
        <GlowButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })} style={{ width: '100%' }}>
          <Icon name="x" size={14}/> Back to Generate
        </GlowButton>
      </div>

      {/* ── Label modal ───────────────────────────────────────────────────────── */}
      {showLabelModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            backgroundColor: 'rgba(6,8,16,0.8)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowLabelModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 380,
              backgroundColor: 'var(--bg1)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              fontFamily: 'var(--font-ui)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text0)' }}>
                Label This Animation
              </h2>
              <button
                onClick={() => setShowLabelModal(false)}
                style={{
                  width: 24, height: 24, border: 'none', background: 'transparent',
                  color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="x" size={16}/>
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              Name this animation in 1–3 words (e.g., &quot;Walk Cycle&quot;).
            </p>

            <input
              autoFocus
              type="text"
              value={animationLabel}
              onChange={(e) => setAnimationLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(); if (e.key === 'Escape') setShowLabelModal(false); }}
              placeholder="e.g. Walk Cycle"
              style={{
                width: '100%', padding: '12px 14px',
                backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                fontSize: 14, color: 'var(--text0)', fontFamily: 'var(--font-ui)', outline: 'none', marginBottom: 16,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {LABEL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setAnimationLabel(tag)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--r-sm)', border: `1px solid ${animationLabel === tag ? 'var(--cyan)' : 'var(--border)'}`,
                    background: animationLabel === tag ? 'var(--cyan-dim)' : 'var(--bg3)',
                    color: animationLabel === tag ? 'var(--cyan)' : 'var(--text2)',
                    fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: 'pointer'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <GlowButton variant="ghost" onClick={() => setShowLabelModal(false)}>Cancel</GlowButton>
              <GlowButton onClick={handleLabelSave} disabled={!animationLabel.trim()}>Save &amp; Start</GlowButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
