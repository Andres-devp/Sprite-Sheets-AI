export async function extractFrames(
  imageSource: string,
  cols = 4,
  rows = 4
): Promise<string[]> {
  if (typeof window === 'undefined') throw new Error('extractFrames is client-only');

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const fw = Math.floor(img.width / cols);
      const fh = Math.floor(img.height / rows);
      const frames: string[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const canvas = document.createElement('canvas');
          canvas.width = fw;
          canvas.height = fh;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
          frames.push(canvas.toDataURL('image/png'));
        }
      }
      resolve(frames);
    };
    img.onerror = () => reject(new Error('Failed to load image for frame extraction'));
    img.src = imageSource;
  });
}
