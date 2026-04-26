'use client';

import { useState } from 'react';
import type { AppState, AppAction, Sprite, Animation, GalleryFilter, GalleryItem } from '@/types';
import ExportModal from './ExportModal';

interface GalleryProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onRemoveBg: (sprite: Sprite) => void;
  onSelectForReview: (ids: string[]) => void;
}

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
  return (
    <div className="group relative">
      <button
        onClick={onToggle}
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border flex items-center justify-center transition-all ${
          hasSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-black/50 border-white/30 hover:border-white/60'}`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <button
        onClick={onDelete}
        className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className={`rounded-xl overflow-hidden border-2 transition-all ${
        isSelected ? 'border-blue-500' : 'border-transparent hover:border-[#333]'
      }`}>
        <div
          className={`aspect-square overflow-hidden cursor-pointer relative ${
            item.type === 'sprite' ? 'bg-[#00FF00]' : 'bg-[#0a0a0a]'
          }`}
          onClick={onClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${item.mimeType};base64,${item.imageBase64}`}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Video play badge for animations */}
          {item.type === 'animation' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] px-2 py-1.5">
          <p className="text-xs text-gray-300 truncate">{item.name}</p>
          <p className="text-[10px] text-gray-600 truncate">
            {item.type === 'sprite' ? item.artStyle : item.animationName}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Gallery({ state, dispatch, onRemoveBg, onSelectForReview }: GalleryProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  const sortedSprites = [...state.sprites].sort((a, b) => b.createdAt - a.createdAt);
  const sortedSheets = [...state.spriteSheets].sort((a, b) => b.createdAt - a.createdAt);
  const sortedAnimations = [...state.animations].sort((a, b) => b.createdAt - a.createdAt);
  const allItems: GalleryItem[] = [...sortedSprites, ...sortedSheets, ...sortedAnimations].sort(
    (a, b) => b.createdAt - a.createdAt
  );
  const recentItems = allItems.slice(0, 5);

  const filteredItems: GalleryItem[] = (() => {
    switch (state.galleryFilter) {
      case 'sprites':      return sortedSprites;
      case 'spritesheets': return sortedSheets;
      case 'animations':   return sortedAnimations;
      default:             return allItems;
    }
  })();

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

  const tabs: { id: GalleryFilter; label: string; count: number }[] = [
    { id: 'all',          label: 'All',          count: allItems.length },
    { id: 'sprites',      label: 'Sprites',      count: state.sprites.length },
    { id: 'animations',   label: 'Animations',   count: state.animations.length },
    { id: 'spritesheets', label: 'Sprite Sheets', count: state.spriteSheets.length },
  ];

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium mb-1">No items yet</p>
        <p className="text-gray-600 text-xs">Generate your first character to see it here</p>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'generate' })}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Create Character
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Gallery</h1>
            <p className="text-gray-500 text-sm mt-0.5">Your generation history</p>
          </div>
          {hasSelected && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Recent section */}
        {recentItems.length > 0 && state.galleryFilter === 'all' && (
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Recent</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentItems.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-24">
                  <div
                    className={`w-24 h-24 rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#444] transition-all ${
                      item.type === 'sprite' ? 'bg-[#00FF00]' : 'bg-[#0a0a0a]'
                    }`}
                    onClick={() => {
                      if (item.type === 'sprite') {
                        onRemoveBg(item);
                      } else if (item.type === 'animation') {
                        const anim = item as Animation;
                        dispatch({ type: 'SET_PENDING_VIDEO', payload: {
                          videoBase64: anim.videoBase64, videoMimeType: anim.videoMimeType,
                          animationName: anim.animationName, spriteName: anim.name,
                          spriteImageBase64: anim.imageBase64, spriteMimeType: anim.mimeType,
                        }});
                      } else {
                        dispatch({ type: 'SET_SELECTED_SHEET', payload: item.id });
                        dispatch({ type: 'SET_VIEW', payload: 'animate' });
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${item.mimeType};base64,${item.imageBase64}`}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 truncate mt-1 text-center">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-[#111] rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_GALLERY_FILTER', payload: tab.id })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                state.galleryFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${state.galleryFilter === tab.id ? 'text-blue-200' : 'text-gray-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Select all */}
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => {
                const ids = filteredItems.map((i) => i.id);
                if (allFilteredSelected) {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    ids.forEach((id) => next.delete(id));
                    return next;
                  });
                } else {
                  setSelected((prev) => new Set([...prev, ...ids]));
                }
              }}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-200 transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                allFilteredSelected ? 'bg-blue-600 border-blue-600' : 'border-[#444]'
              }`}>
                {allFilteredSelected && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              Select All
            </button>
          </div>
        )}

        {/* Grid */}
        {filteredItems.length === 0 ? (
          <p className="text-gray-600 text-sm">Nothing here yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selected.has(item.id)}
                hasSelected={hasSelected}
                onToggle={() => toggleSelect(item.id)}
                onDelete={() => {
                  dispatch({ type: 'DELETE_ITEM', payload: item.id });
                  setSelected((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
                }}
                onClick={() => {
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
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {hasSelected && (
        <div className="flex-shrink-0 border-t border-[#2a2a2a] bg-[#111] px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            {selected.size} item{selected.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-3">
            {selectedSprites.length > 0 && (
              <button
                onClick={() => onSelectForReview(selectedSprites.map((s) => s.id))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Animate {selectedSprites.length} Sprite{selectedSprites.length !== 1 ? 's' : ''} →
              </button>
            )}
            <button
              onClick={() => setShowExport(true)}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-gray-200 text-sm font-medium rounded-lg transition-colors"
            >
              Download ZIP ({selected.size})
            </button>
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal items={selectedItems} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
