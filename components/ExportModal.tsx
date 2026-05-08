'use client';

import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { GalleryItem } from '@/types';
import { Icon, GlowButton } from '@/components/Shared';

interface ExportModalProps {
  items: GalleryItem[];
  onClose: () => void;
}

export default function ExportModal({ items, onClose }: ExportModalProps) {
  const [folderNames, setFolderNames] = useState<string[]>(() =>
    items.map((_, i) => `Image #${i + 1}`)
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIdx !== null) editInputRef.current?.focus();
  }, [editingIdx]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const zip = new JSZip();

      items.forEach((item, i) => {
        const folderName = folderNames[i].trim() || `Image #${i + 1}`;
        const folder = zip.folder(folderName) ?? zip;

        const ext = item.mimeType?.includes('png') ? 'png' : 'webm';
        const safeName = item.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40) || 'asset';
        folder.file(`${safeName}.${ext}`, item.type === 'animation' ? item.videoBase64! : item.imageBase64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spritecraft_export.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        style={{
          backgroundColor: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.01em' }}>Export Assets</h2>
            <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>
              Download {items.length} selected item{items.length !== 1 ? 's' : ''} as a ZIP file.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text0)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}>
          {items.map((item, i) => {
            const folderName = folderNames[i].trim() || `Image #${i + 1}`;
            const ext = item.mimeType?.includes('png') ? 'png' : 'webm';
            const safeName = item.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40) || 'asset';
            const isEditing = editingIdx === i;

            return (
              <div key={item.id} style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--bg3)' }}>
                  <Icon name="layers" size={14} color="var(--text2)" />
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={folderNames[i]}
                      onChange={(e) =>
                        setFolderNames((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      onBlur={() => setEditingIdx(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingIdx(null);
                        e.stopPropagation();
                      }}
                      style={{ flex: 1, backgroundColor: 'var(--bg1)', border: '1px solid var(--cyan)', borderRadius: '4px', padding: '2px 6px', fontSize: '13px', color: 'var(--text0)', fontFamily: 'var(--font-mono)', outline: 'none' }}
                    />
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text1)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folderName}/
                    </span>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => setEditingIdx(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                    >
                      <Icon name="wand" size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px 8px 38px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${item.mimeType};base64,${item.imageBase64}`}
                    alt={item.name}
                    style={{ width: '24px', height: '24px', objectFit: 'contain', imageRendering: 'pixelated', borderRadius: '4px', backgroundColor: 'var(--bg4)', border: '1px solid var(--border)' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {safeName}.{ext}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <GlowButton variant="ghost" onClick={onClose}>Cancel</GlowButton>
          <GlowButton onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Zipping...' : `Download ZIP`}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}
