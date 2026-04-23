import type { ChromaKeySettings } from '@/types';

export function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ChromaKeySettings
): void {
  const { targetColor, tolerance, erosion, edgeSoftness } = settings;
  const [tr, tg, tb] = targetColor;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = tolerance * 3;

  // Pass 1: mark transparent pixels
  const transparent = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const pixel = i / 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb) < threshold) {
      transparent[pixel] = 1;
      data[i + 3] = 0;
    }
  }

  // Pass 2: erosion — erode opaque pixels adjacent to transparent ones
  if (erosion > 0) {
    const toErase = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = y * width + x;
        if (transparent[pixel]) continue;
        outer: for (let dy = -erosion; dy <= erosion; dy++) {
          for (let dx = -erosion; dx <= erosion; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
            if (transparent[ny * width + nx]) { toErase[pixel] = 1; break outer; }
          }
        }
      }
    }
    for (let i = 0; i < toErase.length; i++) {
      if (toErase[i]) { transparent[i] = 1; data[i * 4 + 3] = 0; }
    }
  }

  // Pass 3: edge softness — fade pixels near the transparent boundary
  if (edgeSoftness > 0) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = y * width + x;
        if (transparent[pixel]) continue;
        let minDist = edgeSoftness + 1;
        for (let dy = -edgeSoftness; dy <= edgeSoftness; dy++) {
          for (let dx = -edgeSoftness; dx <= edgeSoftness; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
            if (transparent[ny * width + nx]) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist) minDist = dist;
            }
          }
        }
        if (minDist <= edgeSoftness) {
          const alpha = Math.round((minDist / edgeSoftness) * 255);
          data[pixel * 4 + 3] = Math.min(data[pixel * 4 + 3], alpha);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 255, 0];
}
