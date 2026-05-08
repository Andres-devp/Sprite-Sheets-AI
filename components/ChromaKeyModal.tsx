'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { Sprite } from '@/types';
import { applyChromaKey, hexToRgb } from '@/lib/chromaKey';
import { setupPixelCanvas } from '@/lib/canvasPixel';
import { Icon, GlowButton, Slider } from '@/components/Shared';

interface ChromaKeyModalProps {
  sprite: Sprite;
  onClose: () => void;
  onAnimate?: () => void;
}

const MAX_COLORS = 5;


export default function ChromaKeyModal({ sprite, onClose, onAnimate }: ChromaKeyModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const addColorInputRef = useRef<HTMLInputElement>(null);
  const editColorInputRef = useRef<HTMLInputElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tolerance, setTolerance] = useState(30);
  const [erosion, setErosion] = useState(0);
  const [edgeSoftness, setEdgeSoftness] = useState(0);
  const [chromaColors, setChromaColors] = useState<string[]>(['#00ff00']);
  const [scale, setScale] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      const ctx = setupPixelCanvas(canvas, img.width, img.height, { pixelRatio: 1, applyStyles: false });
      ctx.drawImage(img, 0, 0, img.width, img.height);
      applyChromaKey(ctx, img.width, img.height, {
        targetColors: chromaColors.map(hexToRgb),
        tolerance,
        erosion,
        edgeSoftness,
      });
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageBase64}`;
  }, [sprite, chromaColors, tolerance, erosion, edgeSoftness]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.name.replace(/\s+/g, '-')}-no-bg.png`;
    a.click();
  };

  const handleEditColor = (index: number) => {
    setEditingIndex(index);
    setTimeout(() => editColorInputRef.current?.click(), 0);
  };

  const removeColor = (index: number) => {
    setChromaColors((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          width: '100%', maxWidth: '780px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px',
          borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--bg1)'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text0)', letterSpacing: '-0.01em' }}>Background Removal</div>
            <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>{sprite.name}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text0)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Canvas with zoom/pan */}
          <div
            className="checkerboard"
            style={{
              flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', minHeight: '380px', backgroundColor: 'var(--bg0)',
              cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
              setIsDragging(true);
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== e.pointerId) return;
              setPan({ x: drag.originX + (e.clientX - drag.startX), y: drag.originY + (e.clientY - drag.startY) });
            }}
            onPointerUp={(e) => { if (dragRef.current?.pointerId === e.pointerId) { dragRef.current = null; setIsDragging(false); } }}
            onPointerLeave={(e) => { if (dragRef.current?.pointerId === e.pointerId) { dragRef.current = null; setIsDragging(false); } }}
            onWheel={(e) => {
              e.preventDefault();
              setScale((s) => Math.max(30, Math.min(500, s - e.deltaY * 0.2)));
            }}
            onDoubleClick={() => { setScale(100); setPan({ x: 0, y: 0 }); }}
          >
            <canvas
              ref={canvasRef}
              style={{
                imageRendering: 'pixelated', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                backgroundColor: 'transparent', display: 'block', pointerEvents: 'none',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale / 100})`,
                transformOrigin: 'center', transition: isDragging ? 'none' : 'transform 0.1s',
                maxWidth: '90%', maxHeight: '90%',
              }}
            />
            {/* Zoom controls */}
            <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => setScale((s) => Math.min(500, s + 20))} style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(6,8,16,0.8)', color: 'var(--text1)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>+</button>
              <button onClick={() => setScale((s) => Math.max(30, s - 20))} style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(6,8,16,0.8)', color: 'var(--text1)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>−</button>
              <button onClick={() => { setScale(100); setPan({ x: 0, y: 0 }); }} style={{ height: 28, padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(6,8,16,0.8)', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', backdropFilter: 'blur(4px)' }}>Reset</button>
              <span style={{ fontSize: '11px', color: 'var(--text3)', minWidth: 36, textAlign: 'right' }}>{Math.round(scale)}%</span>
            </div>
            <div style={{ position: 'absolute', bottom: 10, left: 10, fontSize: '11px', color: 'var(--text3)' }}>Scroll · drag · double-click reset</div>
          </div>

          {/* Controls panel */}
          <div style={{
            width: '280px', flexShrink: 0, backgroundColor: 'var(--bg1)', borderLeft: '1px solid var(--border)',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto',
          }}>
            {/* Chroma colors */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text0)' }}>Chroma Colors</div>
                {chromaColors.length < MAX_COLORS && (
                  <button
                    onClick={() => addColorInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                      fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--cyan)',
                      background: 'var(--cyan-dim)', border: '1px solid var(--border2)',
                      borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    }}
                  >
                    <Icon name="plus" size={12} color="var(--cyan)" /> Add
                  </button>
                )}
              </div>

              {/* Color list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chromaColors.map((hex, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleEditColor(i)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                        backgroundColor: 'var(--bg2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <div style={{ width: '22px', height: '22px', backgroundColor: hex, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text1)', fontWeight: 500 }}>{hex.toUpperCase()}</span>
                      <Icon name="eyedrop" size={12} color="var(--text3)" />
                    </button>
                    {chromaColors.length > 1 && (
                      <button
                        onClick={() => removeColor(i)}
                        style={{
                          width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                          color: 'var(--text3)', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Hidden inputs */}
              <input
                ref={addColorInputRef}
                type="color"
                defaultValue="#ffffff"
                onChange={(e) => {
                  const hex = e.target.value;
                  setChromaColors((prev) => prev.includes(hex) ? prev : [...prev, hex]);
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
              <input
                ref={editColorInputRef}
                type="color"
                value={editingIndex !== null ? chromaColors[editingIndex] : '#00ff00'}
                onChange={(e) => {
                  if (editingIndex === null) return;
                  const hex = e.target.value;
                  setChromaColors((prev) => prev.map((c, i) => i === editingIndex ? hex : c));
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text0)' }}>Parameters</div>
              <Slider label="Tolerance" value={tolerance} min={0} max={150} onChange={setTolerance} />
              <Slider label="Erosion" value={erosion} min={0} max={20} onChange={setErosion} />
              <Slider label="Edge Softness" value={edgeSoftness} min={0} max={20} step={0.1} onChange={setEdgeSoftness} />
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
              <GlowButton variant="secondary" onClick={handleDownload} style={{ width: '100%' }}>
                <Icon name="download" size={14} /> Download PNG
              </GlowButton>
              <GlowButton onClick={() => onAnimate?.()} style={{ width: '100%' }}>
                Proceed to Animate →
              </GlowButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
