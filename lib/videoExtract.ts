/**
 * Extracts frames from a video File at a given FPS using HTMLVideoElement + HTMLCanvasElement.
 * Client-side only.
 */
export async function extractVideoFrames(
  videoFile: File,
  fps: number,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  if (typeof window === 'undefined') throw new Error('extractVideoFrames is client-only');

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;
    video.muted = true;
    video.preload = 'metadata';

    video.addEventListener('loadedmetadata', () => {
      const { duration } = video;
      if (!isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read video duration'));
        return;
      }

      const interval = 1 / fps;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frames: string[] = [];
      let frameIndex = 0;

      const canvas = document.createElement('canvas');
      let ctx: CanvasRenderingContext2D | null = null;

      const captureNext = () => {
        if (frameIndex >= totalFrames) {
          URL.revokeObjectURL(objectUrl);
          resolve(frames);
          return;
        }
        video.currentTime = frameIndex * interval;
      };

      video.addEventListener('seeked', () => {
        if (!ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx = canvas.getContext('2d');
        }
        if (!ctx) { frameIndex++; captureNext(); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/png'));
        onProgress?.(frameIndex + 1, totalFrames);
        frameIndex++;
        captureNext();
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Video failed to load'));
      });

      captureNext();
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Video failed to load metadata'));
    });
  });
}
