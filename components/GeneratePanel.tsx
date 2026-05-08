'use client';

import React, { useState, useRef } from 'react';
import type { AppState, AppAction, ArtStyle, CameraAngle } from '@/types';
import { SpriteCraftLogo, Icon, SectionLabel, GlowButton, StyleChip, SegmentControl, Badge } from '@/components/Shared';

interface GeneratePanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const ART_STYLES: { id: ArtStyle; label: string; desc: string }[] = [
  { id: '8bit',       label: '8-Bit',       desc: 'Classic pixel' },
  { id: '16bit',      label: '16-Bit',      desc: 'SNES / MD era' },
  { id: '32bit',      label: '32-Bit',      desc: 'PS1 / N64 era' },
  { id: 'chibi',      label: 'Chibi',       desc: 'Anime SD' },
  { id: 'vector',     label: 'Vector',      desc: 'Flat / SVG-like' },
  { id: 'handdrawn',  label: 'Hand-Drawn',  desc: 'Sketch style' },
];

const CAMERA_ANGLES: { id: CameraAngle; label: string }[] = [
  { id: 'front',         label: 'Front' },
  { id: 'profile',       label: 'Side' },
  { id: 'three-quarter', label: '¾ Iso' },
  { id: 'topdown',       label: 'Top-Down' },
];

const SUGGESTIONS = [
  'Space pirate with laser sword',
  'Fire mage casting spell',
  'Cyberpunk ninja warrior',
  'Forest elf archer',
  'Robot guard patrol',
  'Vampire hunter'
];

export default function GeneratePanel({ state, dispatch }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<ArtStyle>('16bit');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('profile');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const recentSprites = state.sprites.slice(0, 8);

  const handleGenerate = async () => {
    if (!prompt.trim() || state.isGenerating) return;
    dispatch({ type: 'SET_GENERATING', payload: true });
    try {
      const hfKey = localStorage.getItem('hf-api-key') ?? '';
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(hfKey ? { 'X-HF-Token': hfKey } : {}) },
        body: JSON.stringify({ prompt: prompt.trim(), artStyle, cameraAngle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      dispatch({
        type: 'ADD_SPRITE',
        payload: {
          id: crypto.randomUUID(),
          type: 'sprite',
          prompt: prompt.trim(),
          artStyle,
          cameraAngle,
          imageBase64: data.imageBase64,
          mimeType: data.mimeType,
          seed: typeof data.seed === 'number' ? data.seed : undefined,
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

  const handleSuggestion = (s: string) => { 
    setPrompt(s); 
    promptRef.current?.focus(); 
  };

  if (state.isGenerating) {
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
          <div style={{ fontSize:'18px', fontWeight:600, color:'var(--text0)' }}>Generating Character</div>
          <div style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)' }}>&quot;{prompt}&quot;</div>
        </div>
        <div style={{ width:'320px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', fontFamily:'var(--font-ui)', color:'var(--text2)' }}>
            <span>Rendering frames...</span>
            <span style={{ color:'var(--cyan)' }}>Processing</span>
          </div>
          <div style={{ height:'3px', background:'var(--bg5)', borderRadius:'2px', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,var(--cyan2),var(--cyan),var(--purple))', borderRadius:'2px', width:`100%`, transition:'width 0.2s ease', boxShadow:'0 0 10px var(--cyan-glow)', animation: 'shimmer 2s infinite linear', backgroundSize: '200% 100%' }}/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:'flex', height: '100%', minHeight: 0 }}>
      {/* Left: Prompt panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'24px', gap:'20px', overflowY:'auto', minHeight: 0 }}>
        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {['Compose','Review','Export'].map((s,i) => (
            <React.Fragment key={s}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontFamily:'var(--font-ui)', fontWeight:700,
                  background: i === 0 ? 'var(--cyan)' : 'var(--bg4)',
                  color: i === 0 ? '#060810' : 'var(--text3)',
                  border: i === 0 ? 'none' : '1px solid var(--border)'
                }}>{i+1}</div>
                <span style={{ fontSize:'13px', color: i===0?'var(--text0)':'var(--text3)', fontFamily:'var(--font-ui)' }}>{s}</span>
              </div>
              {i < 2 && <div style={{ width:'24px', height:'1px', background:'var(--border)' }}/>}
            </React.Fragment>
          ))}
        </div>

        {/* Prompt textarea */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <SectionLabel>Character Description</SectionLabel>
          <div style={{ position:'relative' }}>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, 500))}
              placeholder="Describe your character in detail… e.g. 'A cyberpunk ninja with glowing katana, dark armor with neon blue accents, determined expression'"
              style={{
                width:'100%', minHeight:'120px', padding:'14px 16px', resize:'vertical',
                background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
                color:'var(--text0)', fontSize:'14px', fontFamily:'var(--font-ui)', lineHeight:1.6,
                outline:'none', transition:'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor='var(--border2)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
            <div style={{ position:'absolute', bottom:'10px', right:'10px', fontSize:'12px', fontFamily:'var(--font-ui)', color:'var(--text3)' }}>{prompt.length}/500</div>
          </div>
          {/* Suggestions */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => handleSuggestion(s)}
                style={{ padding:'4px 10px', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', fontSize:'13px', fontFamily:'var(--font-ui)', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--text1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)'; }}>
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Art Style */}
        <div>
          <SectionLabel>Art Style</SectionLabel>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {ART_STYLES.map(s => <StyleChip key={s.id} label={s.label} selected={artStyle===s.id} onClick={() => setArtStyle(s.id)}/>)}
          </div>
        </div>

        {/* Camera Angle */}
        <div>
          <SectionLabel>Camera Angle</SectionLabel>
          <SegmentControl options={CAMERA_ANGLES} value={cameraAngle} onChange={(v) => setCameraAngle(v as CameraAngle)}/>
        </div>

        {/* Recent generations mini-preview */}
        <div>
          <SectionLabel>Recently Generated</SectionLabel>
          {recentSprites.length === 0 ? (
            <div style={{ padding:'16px', borderRadius:'var(--r-md)', border:'1px dashed var(--border)', color:'var(--text3)', fontSize:'12px', textAlign:'center' }}>
              No generations yet. Create your first character to build a history here.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {recentSprites.map((sprite) => (
                <button
                  key={sprite.id}
                  onClick={() => handleSuggestion(sprite.prompt)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', padding:'10px 6px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--bg2)', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='var(--bg3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg2)'; }}
                >
                  <div style={{ width:'36px', height:'44px', background:'var(--bg1)', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', overflow:'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:${sprite.mimeType};base64,${sprite.imageBase64}`} alt={sprite.name} style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated' }} />
                  </div>
                  <span style={{ fontSize:'12px', color:'var(--text2)', textAlign:'center', lineHeight:1.3 }}>
                    {sprite.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {state.error && (
          <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, var(--danger) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
            [ERROR] {state.error}
          </div>
        )}
      </div>

      {/* Right: CTA panel */}
      <div style={{ width:'300px', borderLeft:'1px solid var(--border)', padding:'24px', display:'flex', flexDirection:'column', gap:'24px', background:'var(--bg1)', overflowY:'auto', height: '100%', minHeight: 0 }}>

        {/* Generate CTA — top and prominent */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:'var(--text0)', letterSpacing:'-0.01em' }}>Ready to generate</div>
          <div style={{ fontSize:'13px', color:'var(--text2)', lineHeight:1.6, minHeight: '40px' }}>
            {prompt.trim() ? `"${prompt.slice(0,60)}${prompt.length>60?'…':''}"` : 'Describe your character to get started.'}
          </div>
          <GlowButton onClick={handleGenerate} disabled={!prompt.trim()} size="lg" style={{ width: '100%' }}>
            <Icon name="sparkle" size={16}/> Generate Character
          </GlowButton>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontSize:'12px', color:'var(--text3)' }}>
            <Icon name="info" size={13} color="var(--text3)"/>
            Uses 1 credit · Auto-saved to Gallery
          </div>
        </div>

        <div style={{ height:'1px', background:'var(--border)' }}/>

        {/* Output preview summary */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <SectionLabel>Output Summary</SectionLabel>
          {[
            { label:'Art Style', value: ART_STYLES.find(s => s.id === artStyle)?.label, icon:'layers' },
            { label:'Camera', value: CAMERA_ANGLES.find(c => c.id === cameraAngle)?.label, icon:'crop' },
            { label:'Frames', value: '12 frames', icon:'grid' },
            { label:'Frame size', value: '64 × 64 px', icon:'filter' },
            { label:'Format', value: 'PNG + JSON', icon:'download' },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:'var(--bg2)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                <Icon name={row.icon} size={14} color="var(--text2)"/>
                <span style={{ fontSize:'13px', color:'var(--text2)', whiteSpace:'nowrap' }}>{row.label}</span>
              </div>
              <span style={{ fontSize:'13px', color:'var(--text1)', fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ height:'1px', background:'var(--border)' }}/>

        {/* Credits widget */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <SectionLabel>Credits</SectionLabel>
          <div style={{ padding:'14px', background:'var(--bg2)', borderRadius:'var(--r-md)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'13px', color:'var(--text1)', fontWeight:500 }}>Pro Plan</span>
              <Badge color="cyan">3 remaining</Badge>
            </div>
            <div style={{ height:'4px', background:'var(--bg5)', borderRadius:'2px', overflow:'hidden' }}>
              <div style={{ width:'30%', height:'100%', background:'linear-gradient(90deg,var(--cyan2),var(--cyan))', borderRadius:'2px' }}/>
            </div>
            <div style={{ fontSize:'12px', color:'var(--text3)' }}>3 of 10 monthly credits used</div>
          </div>
          <button style={{ width:'100%', padding:'9px', borderRadius:'var(--r-md)', border:'1px solid var(--border2)', background:'transparent', color:'var(--cyan)', fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--cyan-dim)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            Upgrade for more credits →
          </button>
        </div>

        <div style={{ height:'1px', background:'var(--border)' }}/>

        {/* Compatible engines */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <SectionLabel>Compatible Engines</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {[
              { name:'Unity', note:'Sprite Atlas ready' },
              { name:'Godot', note:'SpriteFrames import' },
              { name:'Phaser', note:'JSON texture atlas' },
              { name:'GameMaker', note:'Strip format' },
            ].map(eng => (
              <div key={eng.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg2)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 6px var(--success)' }}/>
                  <span style={{ fontSize:'13px', color:'var(--text1)', fontWeight:500 }}>{eng.name}</span>
                </div>
                <span style={{ fontSize:'13px', color:'var(--text3)' }}>{eng.note}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
