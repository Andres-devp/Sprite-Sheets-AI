'use client';

import React, { useState } from 'react';
import type { AppState, AppAction } from '@/types';
import { Icon, GlowButton, SectionLabel, Badge } from '@/components/Shared';

interface AccountPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const USER_NAME = 'Andres';
const USER_EMAIL = 'claudeultrapro@gmail.com';
const PLAN_NAME = 'Pro Plan';
const CREDITS_USED = 7;
const CREDITS_TOTAL = 10;

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: 'var(--r-sm)', flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-ui)', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );
}

export default function AccountPanel({ state, dispatch }: AccountPanelProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  const creditsRemaining = CREDITS_TOTAL - CREDITS_USED;
  const creditsPercent = (CREDITS_USED / CREDITS_TOTAL) * 100;

  const storageBytes = (() => {
    try {
      const raw = localStorage.getItem('spritesheet-v2') ?? '';
      return new Blob([raw]).size;
    } catch { return 0; }
  })();
  const storageKB = (storageBytes / 1024).toFixed(1);

  const handleClearData = () => {
    try { localStorage.removeItem('spritesheet-v2'); } catch {}
    dispatch({ type: 'LOAD_FROM_STORAGE', payload: { sprites: [], spriteSheets: [] } });
    setShowClearConfirm(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', minHeight: 0, animation: 'fadeIn 0.3s ease' }}>
      {/* ── Left: Profile ───────────────────────────────────────────────────── */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--border)', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto' }}>

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--purple), var(--cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', fontWeight: 700, color: '#fff',
              boxShadow: '0 0 32px rgba(139,120,255,0.35)',
            }}>
              {USER_NAME[0].toUpperCase()}
            </div>
            <div style={{
              position: 'absolute', bottom: 2, right: 2, width: '18px', height: '18px',
              borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg1)',
              boxShadow: '0 0 8px var(--success)',
            }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.01em' }}>{USER_NAME}</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', fontFamily: 'var(--font-ui)', marginTop: '4px' }}>{USER_EMAIL}</div>
          </div>
          <Badge color="purple">{PLAN_NAME}</Badge>
        </div>

        {/* Credits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionLabel>Credits</SectionLabel>
          <div style={{ padding: '16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 500 }}>Monthly Credits</span>
              <span style={{ fontSize: '13px', color: 'var(--cyan)', fontWeight: 700 }}>{creditsRemaining} left</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg5)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '3px',
                width: `${creditsPercent}%`,
                background: creditsPercent > 80
                  ? 'linear-gradient(90deg, var(--warn), #ff7c5c)'
                  : 'linear-gradient(90deg, var(--cyan2), var(--cyan))',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>
              {CREDITS_USED} of {CREDITS_TOTAL} used this month
            </div>
          </div>
          <GlowButton variant="secondary" style={{ width: '100%' }}>
            <Icon name="sparkle" size={14} /> Upgrade Plan
          </GlowButton>
        </div>

        {/* Compatible engines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel>Compatible Engines</SectionLabel>
          {[
            { name: 'Unity', note: 'Sprite Atlas ready' },
            { name: 'Godot', note: 'SpriteFrames import' },
            { name: 'Phaser', note: 'JSON texture atlas' },
            { name: 'GameMaker', note: 'Strip format' },
          ].map(eng => (
            <div key={eng.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                <span style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 500 }}>{eng.name}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{eng.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Stats + Settings ─────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '32px 32px', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto' }}>

        {/* Usage stats */}
        <div>
          <SectionLabel>Usage Statistics</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '4px' }}>
            <StatCard label="Sprites Generated" value={state.sprites.length} icon="sparkle" color="#5695e6" />
            <StatCard label="Sprite Sheets" value={state.spriteSheets.length} icon="grid" color="#8b78ff" />
            <StatCard label="Animations" value={state.animations.length} icon="video" color="#44e888" />
          </div>
        </div>

        {/* Storage */}
        <div>
          <SectionLabel>Local Storage</SectionLabel>
          <div style={{ padding: '16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="download" size={18} color="var(--text2)" />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 500 }}>Sprites &amp; Sheets cached</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>Stored in browser localStorage</div>
              </div>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--cyan)' }}>{storageKB} KB</span>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <SectionLabel>Preferences</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Auto-save to Gallery', sub: 'Sprites are saved automatically after generation', enabled: true },
              { label: 'Green Screen on Generate', sub: 'AI sprites use green background for chroma keying', enabled: true },
              { label: 'Pixel-perfect rendering', sub: 'Uses nearest-neighbor interpolation on previews', enabled: true },
            ].map(pref => (
              <div key={pref.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 500 }}>{pref.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px', fontFamily: 'var(--font-ui)' }}>{pref.sub}</div>
                </div>
                <div className={`toggle-track on`} style={{ width: '36px', height: '20px', flexShrink: 0, pointerEvents: 'none' }}>
                  <div className="toggle-thumb" style={{ width: '14px', height: '14px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div>
          <SectionLabel>Data Management</SectionLabel>
          <div style={{ padding: '20px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 'var(--r-md)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text0)' }}>Clear All Local Data</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '4px', fontFamily: 'var(--font-ui)' }}>
                Permanently removes all sprites and sheets from browser storage. Animations are session-only and already not persisted.
              </div>
            </div>

            {cleared && (
              <div style={{ fontSize: '13px', color: 'var(--success)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="check" size={14} color="var(--success)" /> Data cleared successfully.
              </div>
            )}

            {!showClearConfirm ? (
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                style={{ width: 'fit-content', borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                <Icon name="x" size={14} /> Clear All Data
              </GlowButton>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>Are you sure?</span>
                <GlowButton size="sm" onClick={handleClearData} style={{ background: 'var(--danger)', border: 'none', color: '#fff' }}>
                  Yes, clear
                </GlowButton>
                <GlowButton variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>
                  Cancel
                </GlowButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
