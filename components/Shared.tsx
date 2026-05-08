import React, { useState } from 'react';

export function SpriteCraftLogo({ size = 32, glow = true }: { size?: number, glow?: boolean }) {
  const id = 'lg' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id + 'g'} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7ab8ff"/>
          <stop offset="100%" stopColor="#5695e6"/>
        </linearGradient>
        {glow && <filter id={id + 'f'}><feGaussianBlur stdDeviation="1.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>}
      </defs>
      <rect x="3" y="3" width="11" height="11" rx="2.5" fill={`url(#${id}g)`} opacity="1" filter={glow?`url(#${id}f)`:undefined}/>
      <rect x="18" y="3" width="11" height="11" rx="2.5" fill={`url(#${id}g)`} opacity="0.55"/>
      <rect x="3" y="18" width="11" height="11" rx="2.5" fill={`url(#${id}g)`} opacity="0.55"/>
      <rect x="18" y="18" width="4.5" height="4.5" rx="1.2" fill={`url(#${id}g)`} opacity="0.9" filter={glow?`url(#${id}f)`:undefined}/>
      <rect x="24.5" y="18" width="4.5" height="4.5" rx="1.2" fill={`url(#${id}g)`} opacity="0.55"/>
      <rect x="18" y="24.5" width="4.5" height="4.5" rx="1.2" fill={`url(#${id}g)`} opacity="0.55"/>
      <rect x="24.5" y="24.5" width="4.5" height="4.5" rx="1.2" fill={`url(#${id}g)`} opacity="0.3"/>
    </svg>
  );
}

export const Icon = ({ name, size = 18, color = 'currentColor' }: { name: string, size?: number, color?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    sparkle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    video: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/></svg>,
    grid: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    history: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><circle cx="12" cy="7" r="4"/><path d="M2 21c0-5 4-9 10-9s10 4 10 9"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    play: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><polygon points="5,3 19,12 5,21"/></svg>,
    pause: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    wand: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M15 4V2m0 14v-2M8 9H2m14 0h-2M3.5 3.5l1.5 1.5M18 18l1.5 1.5M3.5 14.5l1.5-1.5M18 6l1.5-1.5"/><path d="m7 21 14-14"/></svg>,
    eyedrop: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M20 3.8a2.83 2.83 0 0 0-4 0l-7.5 7.5-2 4 4-2 7.5-7.5a2.83 2.83 0 0 0 0-4z"/><path d="M6 17 4 21l4-2"/></svg>,
    crop: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M6 2v14h14"/><path d="M2 6h14v14"/></svg>,
    filter: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    layers: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    info: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    chevron: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  };
  return <>{icons[name] || null}</>;
};

export function Tooltip({ children, label }: { children: React.ReactNode, label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative', display:'flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && label && (
        <div style={{
          position:'absolute', left:'calc(100% + 10px)', top:'50%', transform:'translateY(-50%)',
          background:'var(--bg4)', border:'1px solid var(--border2)', borderRadius:'var(--r-sm)',
          padding:'4px 10px', whiteSpace:'nowrap', fontSize:'13px', color:'var(--text1)',
          fontFamily:'var(--font-ui)', zIndex:1000, pointerEvents:'none',
          animation:'fadeIn 0.15s ease', boxShadow:'0 8px 24px rgba(0,0,0,0.4)'
        }}>{label}</div>
      )}
    </div>
  );
}

export function Badge({ children, color = 'cyan' }: { children: React.ReactNode, color?: string }) {
  const c = color === 'cyan' ? '#58e6d9' : color === 'purple' ? '#8b78ff' : color === 'warn' ? '#ffb830' : '#44e888';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:'4px',
      padding:'2px 9px', borderRadius:'20px', fontSize:'12px', fontWeight:600,
      background:`${c}18`, color:c, border:`1px solid ${c}30`,
      fontFamily:'var(--font-ui)', letterSpacing:'0.06em', textTransform:'uppercase'
    }}>{children}</span>
  );
}

export function Slider({ label, value, onChange, min=0, max=100, step=1, unit='' }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number, step?: number, unit?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'13px', color:'var(--text2)', fontFamily:'var(--font-ui)', fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:'13px', color:'var(--cyan)', fontFamily:'var(--font-ui)', fontWeight:500 }}>{value}{unit}</span>
      </div>
      <div style={{ position:'relative', height:'20px', display:'flex', alignItems:'center' }}>
        <div style={{
          width:'100%', height:'3px', background:'var(--bg5)', borderRadius:'2px', position:'relative', overflow:'visible'
        }}>
          <div style={{ width:`${((value-min)/(max-min))*100}%`, height:'100%', background:'linear-gradient(90deg,var(--cyan2),var(--cyan))', borderRadius:'2px', position:'absolute' }}/>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position:'absolute', width:'100%', opacity:0, cursor:'pointer', height:'20px', zIndex:2 }}/>
      </div>
    </div>
  );
}

export function SegmentControl({ options, value, onChange }: { options: { id?: string, value?: string, label?: string }[] | string[], value: string, onChange: (v: string) => void }) {
  return (
    <div style={{ display:'flex', background:'var(--bg2)', borderRadius:'var(--r-sm)', padding:'2px', gap:'1px', border:'1px solid var(--border)' }}>
      {options.map(opt => {
        const optValue = typeof opt === 'string' ? opt : (opt.id || opt.value || '');
        const optLabel = typeof opt === 'string' ? opt : (opt.label || optValue);
        return (
          <button key={optValue} onClick={() => onChange(optValue)}
            style={{
              flex:1, padding:'5px 8px', borderRadius:'4px', border:'none', cursor:'pointer',
              fontSize:'13px', fontFamily:'var(--font-ui)', fontWeight:500,
              background: optValue === value ? 'var(--bg5)' : 'transparent',
              color: optValue === value ? 'var(--cyan)' : 'var(--text2)',
              transition:'all 0.15s ease', whiteSpace:'nowrap',
              boxShadow: optValue === value ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'
            }}>
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
      <span style={{ fontSize:'12px', color:'var(--text2)', fontFamily:'var(--font-ui)', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{children}</span>
      <div style={{ flex:1, height:'1px', background:'var(--border)' }}/>
    </div>
  );
}

export function GlowButton({ children, onClick, disabled = false, size = 'md', variant = 'primary', className = '', style }: { children: React.ReactNode, onClick?: () => void, disabled?: boolean, size?: 'sm' | 'md' | 'lg', variant?: 'primary' | 'secondary' | 'ghost', className?: string, style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false);
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const pad = size === 'lg' ? '12px 28px' : size === 'sm' ? '6px 14px' : '9px 20px';
  const fs = size === 'lg' ? '15px' : size === 'sm' ? '13px' : '14px';
  return (
    <button onClick={onClick} disabled={disabled} className={className}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display:'inline-flex', alignItems:'center', justifyContent: 'center', gap:'8px', padding:pad,
        borderRadius:'var(--r-md)', border: isPrimary ? 'none' : `1px solid ${hover ? 'var(--cyan)' : 'var(--border2)'}`,
        background: isPrimary
          ? (hover ? 'linear-gradient(135deg,#3dd4c7,#58e6d9)' : 'linear-gradient(135deg,#2fcec1,#4de0d3)')
          : (hover ? 'var(--cyan-dim)' : isGhost ? 'transparent' : 'var(--bg3)'),
        color: isPrimary ? '#060810' : (hover ? 'var(--cyan)' : 'var(--text1)'),
        fontSize:fs, fontFamily:'var(--font-ui)', fontWeight:600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, transition:'all 0.2s ease',
        boxShadow: isPrimary && hover ? '0 0 24px var(--cyan-glow), 0 4px 16px rgba(0,0,0,0.3)' : isPrimary ? '0 4px 16px rgba(0,0,0,0.2)' : 'none',
        transform: hover && !disabled ? 'translateY(-1px)' : 'none',
        ...style
      }}>
      {children}
    </button>
  );
}

export function StyleChip({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding:'6px 12px', borderRadius:'var(--r-sm)', border:`1px solid ${selected?'var(--cyan)':'var(--border)'}`,
      background: selected ? 'var(--cyan-dim)' : 'var(--bg3)', color: selected ? 'var(--cyan)' : 'var(--text2)',
      fontSize:'12px', fontFamily:'var(--font-ui)', cursor:'pointer', transition:'all 0.15s ease',
      fontWeight: selected ? 600 : 400,
      boxShadow: selected ? '0 0 12px var(--cyan-glow)' : 'none'
    }}>{label}</button>
  );
}
