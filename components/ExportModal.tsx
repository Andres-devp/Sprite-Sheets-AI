'use client';

import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { GalleryItem } from '@/types';

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

        const ext = item.mimeType?.includes('png') ? 'png' : 'jpg';
        const safeName = item.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40) || 'image';
        folder.file(`${safeName}.${ext}`, item.imageBase64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sprites_export.zip`;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Download Sprites</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3a3a3a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          File Preview ({items.length} file{items.length !== 1 ? 's' : ''})
        </p>

        <div className="bg-[#111] rounded-lg border border-[#2a2a2a] overflow-hidden mb-5 max-h-64 overflow-y-auto">
          {items.map((item, i) => {
            const folderName = folderNames[i].trim() || `Image #${i + 1}`;
            const ext = item.mimeType?.includes('png') ? 'png' : 'jpg';
            const safeName = item.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40) || 'image';
            const isEditing = editingIdx === i;

            return (
              <div key={item.id}>
                {/* Folder row */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e1e]">
                  <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
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
                      className="flex-1 bg-[#1a1a1a] border border-blue-500 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none min-w-0"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-mono flex-1 truncate">
                      {folderName}/
                    </span>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => setEditingIdx(i)}
                      className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* File row */}
                <div className="flex items-center gap-2 px-3 py-1.5 pl-7 border-b border-[#1a1a1a]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${item.mimeType};base64,${item.imageBase64}`}
                    alt={item.name}
                    className="w-4 h-4 object-cover rounded flex-shrink-0"
                  />
                  <span className="text-xs text-gray-600 font-mono truncate">
                    {safeName}.{ext}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-2 text-sm bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {downloading ? 'Zipping…' : `Download ZIP (${items.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
