'use client';

import React, { useState } from 'react';
import type { AppView, GalleryItem } from '@/types';
import { SpriteCraftLogo, Icon, Tooltip } from '@/components/Shared';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  recentItems: GalleryItem[];
  onRecentClick: (item: GalleryItem) => void;
  variantIsB?: boolean;
}

function resolveActiveNav(view: AppView): AppView {
  if (view === 'review' || view === 'animate') return 'generate';
  return view;
}

export default function Sidebar({ currentView, onNavigate, recentItems, onRecentClick, variantIsB = false }: SidebarProps) {
  const activeNav = resolveActiveNav(currentView);
  const [historyOpen, setHistoryOpen] = useState(false);

  const navItems: { id: AppView; icon: string; label: string }[] = [
    { id: 'generate', icon: 'sparkle', label: 'AI Generate' },
    { id: 'video', icon: 'video', label: 'Video to Sprite' },
    { id: 'gallery', icon: 'grid', label: 'Gallery' },
  ];

  return (
    <>
      {/* ── Icon Sidebar ── */}
      <div style={{
        width:'var(--sidebar-w)', height:'100%', display:'flex', flexDirection:'column',
        alignItems:'center', borderRight:'1px solid var(--border)',
        background: variantIsB
          ? 'linear-gradient(180deg,var(--bg2),var(--bg1))'
          : 'var(--bg1)',
        paddingTop:'16px', paddingBottom:'16px', gap:'4px',
        zIndex:10, flexShrink:0
      }}>
        {/* Logo */}
        <div style={{ marginBottom:'16px', padding:'4px' }}>
          <SpriteCraftLogo size={30}/>
        </div>

        <div style={{ width:'36px', height:'1px', background:'var(--border)', marginBottom:'8px' }}/>

        {/* Nav items */}
        {navItems.map(item => (
          <Tooltip key={item.id} label={item.label}>
            <button onClick={() => onNavigate(item.id)}
              style={{
                width:'50px', height:'50px', borderRadius:'var(--r-md)', border:'none',
                background: activeNav === item.id
                  ? (variantIsB ? 'linear-gradient(135deg,rgba(86,149,230,0.2),rgba(139,120,255,0.1))' : 'var(--cyan-dim)')
                  : 'transparent',
                color: activeNav === item.id ? 'var(--cyan)' : 'var(--text2)',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.2s ease',
                boxShadow: activeNav === item.id ? '0 0 16px var(--cyan-glow)' : 'none',
                position:'relative'
              }}>
              <Icon name={item.icon} size={22}/>
              {activeNav === item.id && (
                <div style={{ position:'absolute', left:'2px', top:'50%', transform:'translateY(-50%)', width:'2px', height:'24px', background:'var(--cyan)', borderRadius:'1px', boxShadow:'0 0 8px var(--cyan-glow)' }}/>
              )}
            </button>
          </Tooltip>
        ))}

        <div style={{ flex:1 }}/>

        {/* Bottom actions */}
        <Tooltip label="Recent History">
          <button onClick={() => setHistoryOpen(!historyOpen)}
            style={{
              width:'50px', height:'50px', borderRadius:'var(--r-md)', border:'none',
              background: historyOpen ? 'var(--purple-dim)' : 'transparent',
              color: historyOpen ? 'var(--purple)' : 'var(--text2)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s'
            }}>
            <Icon name="history" size={22}/>
          </button>
        </Tooltip>
        <Tooltip label="Account">
          <button onClick={() => onNavigate('account')} style={{
            width:'50px', height:'50px', borderRadius:'var(--r-md)', border:'none',
            background: activeNav === 'account' ? 'var(--purple-dim)' : 'transparent',
            color:'var(--text2)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s',
            boxShadow: activeNav === 'account' ? '0 0 16px rgba(139,120,255,0.2)' : 'none',
          }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,var(--purple),var(--cyan))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, color:'#fff', boxShadow: activeNav === 'account' ? '0 0 10px rgba(139,120,255,0.5)' : 'none' }}>A</div>
          </button>
        </Tooltip>
      </div>

      {/* ── History Drawer ── */}
      {historyOpen && (
        <div style={{
          width:'220px', height:'100%', borderRight:'1px solid var(--border)', background:'var(--bg1)',
          display:'flex', flexDirection:'column', animation:'slideInLeft 0.2s ease', flexShrink:0
        }}>
          <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text1)', fontFamily:'var(--font-ui)' }}>Recent</span>
            <button onClick={() => setHistoryOpen(false)} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer' }}><Icon name="x" size={14}/></button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
            {recentItems.map(item => {
              const color = item.type === 'sprite' ? '#5695e6' : item.type === 'spritesheet' ? '#8b78ff' : '#ffb830';
              return (
                <button key={item.id} onClick={() => { setHistoryOpen(false); onRecentClick(item); }}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px',
                    borderRadius:'var(--r-sm)', border:'none', background:'transparent', cursor:'pointer',
                    transition:'all 0.15s', textAlign:'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'6px', background:`${color}20`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {item.type === 'sprite' ? <Icon name="sparkle" size={16} color={color}/> : 
                     item.type === 'spritesheet' ? <Icon name="grid" size={16} color={color}/> : 
                     <Icon name="video" size={16} color={color}/>}
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:500, color:'var(--text1)' }}>{item.name || 'Unnamed'}</div>
                    <div style={{ fontSize:'12px', color:'var(--text3)', fontFamily:'var(--font-ui)', marginTop:'1px', textTransform:'capitalize' }}>{item.type}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
