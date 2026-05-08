'use client';

import React, { useState, useMemo } from 'react';
import type { AppState, AppAction, Sprite, Animation, GalleryFilter, GalleryItem } from '@/types';
import ExportModal from './ExportModal';
import { Icon, GlowButton } from '@/components/Shared';

interface GalleryProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onRemoveBg: (sprite: Sprite) => void;
  onSelectForReview: (ids: string[]) => void;
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  isSelected,
  hasSelected,
  onToggle,
  onDelete,
  onClick,
}: {
  item: GalleryItem;
  isSelected: boolean;
  hasSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const typeBadge: Record<GalleryItem['type'], { label: string; color: string }> = {
    sprite:      { label: 'SPR', color: '#5695e6' },
    spritesheet: { label: 'SHT', color: '#8b78ff' },
    animation:   { label: 'ANI', color: '#44e888' },
  };
  const badge = typeBadge[item.type];

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        backgroundColor: isSelected ? 'var(--cyan-dim)' : 'var(--bg2)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!isSelected) {
          el.style.borderColor = 'color-mix(in srgb, var(--cyan) 40%, transparent)';
          el.style.backgroundColor = 'var(--bg3)';
        }
        const checkbox = el.querySelector<HTMLElement>('.item-cb');
        if (checkbox) checkbox.style.opacity = '1';
        const del = el.querySelector<HTMLElement>('.item-del');
        if (del) del.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!isSelected) {
          el.style.borderColor = 'var(--border)';
          el.style.backgroundColor = 'var(--bg2)';
        }
        if (!hasSelected) {
          const checkbox = el.querySelector<HTMLElement>('.item-cb');
          if (checkbox) checkbox.style.opacity = '0';
        }
        const del = el.querySelector<HTMLElement>('.item-del');
        if (del) del.style.opacity = '0';
      }}
    >
      {/* Select checkbox */}
      <button
        onClick={onToggle}
        className="item-cb"
        style={{
          position: 'absolute', top: 8, left: 8, zIndex: 10,
          width: 20, height: 20, borderRadius: '4px',
          border: `1px solid ${isSelected ? 'var(--cyan)' : 'rgba(255,255,255,0.3)'}`,
          backgroundColor: isSelected ? 'var(--cyan)' : 'rgba(6,8,16,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hasSelected || isSelected ? 1 : 0,
          transition: 'all 0.15s',
        }}
      >
        {isSelected && <Icon name="check" size={14} color="var(--bg0)" />}
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="item-del"
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          width: 24, height: 24, borderRadius: 'var(--r-sm)', border: 'none',
          backgroundColor: 'rgba(6,8,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: 0, transition: 'all 0.15s', color: 'rgba(255,255,255,0.7)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(6,8,16,0.6)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
      >
        <Icon name="x" size={14} />
      </button>

      {/* Image Area */}
      <div onClick={onClick} style={{ width: '100%', padding: '12px 12px 0 12px', cursor: 'pointer' }}>
        <div style={{
          width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)',
          backgroundColor: `${badge.color}18`, border: `1px solid ${badge.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${item.mimeType};base64,${item.imageBase64}`}
            alt={item.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
          />
          {item.type === 'animation' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="play" size={12} color="white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Area */}
      <div style={{ padding: '10px 12px' }} onClick={onClick}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text0)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name || 'Unnamed Asset'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text2)' }}>
          <span style={{ textTransform: 'capitalize' }}>{item.type === 'sprite' ? item.artStyle : item.type === 'spritesheet' ? `${(item as import('@/types').SpriteSheet).cols} cols` : item.animationName}</span>
          <span style={{ color: badge.color, fontWeight: 500 }}>{badge.label}</span>
        </div>
      </div>
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────

export default function Gallery({ state, dispatch, onRemoveBg, onSelectForReview }: GalleryProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);

  const sortedSprites = useMemo(() =>
    [...state.sprites].sort((a, b) => b.createdAt - a.createdAt), [state.sprites]);
  const sortedSheets = useMemo(() =>
    [...state.spriteSheets].sort((a, b) => b.createdAt - a.createdAt), [state.spriteSheets]);
  const sortedAnimations = useMemo(() =>
    [...state.animations].sort((a, b) => b.createdAt - a.createdAt), [state.animations]);

  const allItems: GalleryItem[] = useMemo(() =>
    [...sortedSprites, ...sortedSheets, ...sortedAnimations].sort((a, b) => b.createdAt - a.createdAt),
    [sortedSprites, sortedSheets, sortedAnimations]
  );

  const filteredItems: GalleryItem[] = useMemo(() => {
    let base: GalleryItem[];
    switch (state.galleryFilter) {
      case 'sprites':      base = sortedSprites; break;
      case 'spritesheets': base = sortedSheets; break;
      case 'animations':   base = sortedAnimations; break;
      default:             base = allItems;
    }
    return sortAsc ? [...base].sort((a, b) => a.createdAt - b.createdAt) : base;
  }, [state.galleryFilter, sortedSprites, sortedSheets, sortedAnimations, allItems, sortAsc]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const selectedItems = allItems.filter((item) => selected.has(item.id));
  const selectedSprites = selectedItems.filter((item): item is Sprite => item.type === 'sprite');
  const hasSelected = selected.size > 0;
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selected.has(i.id));

  const tabs: { id: GalleryFilter; label: string }[] = [
    { id: 'all',          label: 'All' },
    { id: 'sprites',      label: 'Base Sprites' },
    { id: 'spritesheets', label: 'Sheets' },
    { id: 'animations',   label: 'Animations' },
  ];

  const handleItemClick = (item: GalleryItem) => {
    if (item.type === 'sprite') {
      onRemoveBg(item);
    } else if (item.type === 'animation') {
      const anim = item as Animation;
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
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (allItems.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center', padding: '0 32px',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--text2)', background: 'var(--bg2)' }}>
          <Icon name="grid" size={24} />
        </div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text0)', marginBottom: 8 }}>Gallery Empty</div>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24, maxWidth: 260, lineHeight: 1.5 }}>
          Generate a character or import a video to populate your gallery.
        </p>
        <GlowButton onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })}>
          Create Character
        </GlowButton>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', backgroundColor: 'var(--bg0)' }}>
      {/* ── Main scroll area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px', overflowY: 'auto', animation: 'fadeIn 0.3s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.02em' }}>Asset Library</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '3px' }}>
              {allItems.length} assets · {state.spriteSheets.length} sheets · {state.animations.length} animations
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {hasSelected && (
              <GlowButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <Icon name="x" size={12}/> Clear Selection
              </GlowButton>
            )}
            <GlowButton variant="secondary" size="sm" onClick={() => setSortAsc((v) => !v)}>
              <Icon name="filter" size={12}/> {sortAsc ? 'Oldest First' : 'Newest First'}
            </GlowButton>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {tabs.map((tab) => {
            const isActive = state.galleryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_GALLERY_FILTER', payload: tab.id })}
                style={{
                  padding: '6px 14px', borderRadius: '20px', border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                  background: isActive ? 'var(--cyan-dim)' : 'transparent',
                  color: isActive ? 'var(--cyan)' : 'var(--text2)',
                  fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all 0.15s',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {tab.label}
              </button>
            );
          })}
          
          {filteredItems.length > 0 && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 8px' }} />
              <button
                onClick={() => {
                  const ids = filteredItems.map((i) => i.id);
                  if (allFilteredSelected) {
                    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
                  } else {
                    setSelected((prev) => new Set([...prev, ...ids]));
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px',
                  border: `1px solid ${allFilteredSelected ? 'var(--cyan)' : 'transparent'}`,
                  background: allFilteredSelected ? 'var(--cyan-dim)' : 'transparent', color: allFilteredSelected ? 'var(--cyan)' : 'var(--text2)',
                  fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all 0.15s', fontWeight: allFilteredSelected ? 600 : 400
                }}
              >
                {allFilteredSelected ? <Icon name="check" size={12} /> : null}
                Select All
              </button>
            </>
          )}
        </div>

        {/* Grid */}
        {filteredItems.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 24, textAlign: 'center' }}>Nothing matches this filter.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selected.has(item.id)}
                hasSelected={hasSelected}
                onToggle={() => toggleSelect(item.id)}
                onDelete={() => {
                  dispatch({ type: 'DELETE_ITEM', payload: item.id });
                  setSelected((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
                }}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {hasSelected && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg1)',
          padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          animation: 'fadeIn 0.2s ease'
        }}>
          <span style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>
            {selected.size} item{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            {selectedSprites.length > 0 && (
              <GlowButton onClick={() => onSelectForReview(selectedSprites.map((s) => s.id))}>
                <Icon name="wand" size={14} /> Animate {selectedSprites.length} Sprite{selectedSprites.length !== 1 ? 's' : ''} →
              </GlowButton>
            )}
            <GlowButton variant="secondary" onClick={() => setShowExport(true)}>
              <Icon name="download" size={14} /> Export ZIP ({selected.size})
            </GlowButton>
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal items={selectedItems} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
