export interface PixelCanvasOptions {
  pixelRatio?: number;
  applyStyles?: boolean;
}

export function getDevicePixelRatio() {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

export function setupPixelCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  options: PixelCanvasOptions = {}
) {
  const ratio = options.pixelRatio ?? 1;
  const cssWidth = Math.max(1, Math.round(width));
  const cssHeight = Math.max(1, Math.round(height));

  canvas.width = Math.max(1, Math.round(cssWidth * ratio));
  canvas.height = Math.max(1, Math.round(cssHeight * ratio));

  if (options.applyStyles ?? true) {
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context not available');
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'low';

  return ctx;
}
