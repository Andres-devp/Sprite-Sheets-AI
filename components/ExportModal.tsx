'use client';

import { useState } from 'react';
import JSZip from 'jszip';

interface ExportModalProps {
  frames: string[];
  selectedFrameIndices: number[];
  defaultFilename: string;
  onClose: () => void;
}

export default function ExportModal({
  frames,
  selectedFrameIndices,
  defaultFilename,
  onClose,
}: ExportModalProps) {
  const [filename, setFilename] = useState(defaultFilename || 'sprite-export');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!filename.trim() || downloading) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(filename.trim()) ?? zip;

      selectedFrameIndices.forEach((frameIdx, i) => {
        const dataUrl = frames[frameIdx];
        const base64 = dataUrl.split(',')[1];
        folder.file(`frame_${String(i).padStart(3, '0')}.png`, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename.trim()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && filename.trim()) handleDownload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-white mb-5">Download Sprite Frames</h2>

        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">File / Folder Name</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="e.g. warrior, skeleton, robot"
            autoFocus
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="bg-[#111] rounded-lg p-3 mb-5 border border-[#2a2a2a]">
          <p className="text-xs text-gray-500 font-mono">
            {filename.trim() || 'sprites'}/
          </p>
          {selectedFrameIndices.slice(0, 5).map((_, i) => (
            <p key={i} className="text-xs text-gray-600 font-mono pl-3">
              frame_{String(i).padStart(3, '0')}.png
            </p>
          ))}
          {selectedFrameIndices.length > 5 && (
            <p className="text-xs text-gray-700 font-mono pl-3">
              … {selectedFrameIndices.length - 5} more
            </p>
          )}
        </div>

        <p className="text-xs text-gray-600 mb-5">
          {selectedFrameIndices.length} PNG frame{selectedFrameIndices.length !== 1 ? 's' : ''} will be saved inside a ZIP archive.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || !filename.trim()}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {downloading ? 'Zipping…' : `Download ZIP (${selectedFrameIndices.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
