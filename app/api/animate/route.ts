import { NextRequest } from 'next/server';
import { Client, handle_file } from '@gradio/client';

export const maxDuration = 300; // 5 min — Gradio queue can take 1–3 min

const SPACE_ID = 'stabilityai/stable-video-diffusion';
const SPACE_BASE = 'https://stabilityai-stable-video-diffusion.hf.space';

export async function POST(req: NextRequest) {
  let body: {
    sourcePrompt?: string;
    animationName?: string;
    artStyle?: string;
    cameraAngle?: string;
    spriteImageBase64?: string;
    spriteMimeType?: string;
    sourceSeed?: number;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    sourcePrompt,
    animationName,
    spriteImageBase64,
    spriteMimeType = 'image/png',
    sourceSeed,
  } = body;

  if (!sourcePrompt?.trim() || !animationName?.trim()) {
    return Response.json(
      { error: 'sourcePrompt and animationName are required' },
      { status: 400 },
    );
  }
  if (!spriteImageBase64?.trim()) {
    return Response.json({ error: 'spriteImageBase64 is required' }, { status: 400 });
  }

  try {
    const imageBuffer = Buffer.from(spriteImageBase64, 'base64');
    const imageBlob = new Blob([imageBuffer], { type: spriteMimeType });

    // Authenticated requests get priority queue on HF Spaces
    const hfToken = process.env.HUGGINGFACE_API_KEY as `hf_${string}` | undefined;

    console.log('[animate] connecting to Gradio Space:', SPACE_ID);
    const gradioClient = await Client.connect(SPACE_ID, {
      ...(hfToken ? { token: hfToken } : {}),
    });

    const seed = typeof sourceSeed === 'number'
      ? sourceSeed
      : Math.floor(Math.random() * 2_147_483_647);

    console.log('[animate] submitting to Gradio queue...');

    // Confirmed schema from view_api():
    //   image (Blob|File|Buffer), seed (number), randomize_seed (bool),
    //   motion_bucket_id (number 1–255), fps_id (number 5–30)
    // Returns[0]: { video: filepath_string, subtitles: string|null }
    const result = await gradioClient.predict('/video', {
      image: handle_file(imageBlob),
      seed,
      randomize_seed: false,
      motion_bucket_id: 127,
      fps_id: 10,
    });

    console.log('[animate] Gradio queue finished');

    const data = (result as { data: unknown[] }).data;
    console.log('[animate] raw output:', JSON.stringify(data, null, 2));

    // data[0] = { video: { path: string, url: string, ... }, subtitles: null }
    const output0 = data[0] as {
      video?: { path?: string; url?: string } | string | null;
      subtitles?: string | null;
    } | null;

    const videoField = output0?.video;
    if (!videoField) {
      throw new Error(`No video in output: ${JSON.stringify(data).slice(0, 300)}`);
    }

    // video field can be a FileData object or a plain string path
    let videoUrl: string;
    if (typeof videoField === 'string') {
      videoUrl = videoField.startsWith('http')
        ? videoField
        : `${SPACE_BASE}/file=${videoField}`;
    } else {
      // Prefer .url (already absolute) over building from .path
      videoUrl = videoField.url
        ?? (videoField.path ? `${SPACE_BASE}/file=${videoField.path}` : '');
    }

    if (!videoUrl) {
      throw new Error(`Could not resolve video URL: ${JSON.stringify(videoField)}`);
    }

    console.log('[animate] fetching video from:', videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video (${videoRes.status}): ${videoUrl}`);
    }
    const videoMimeType = videoRes.headers.get('content-type') ?? 'video/mp4';
    const videoBase64 = Buffer.from(await videoRes.arrayBuffer()).toString('base64');

    return Response.json({ videoBase64, videoMimeType });
  } catch (err: unknown) {
    // Stringify non-Error objects (Gradio throws plain objects on API errors)
    const msg = err instanceof Error
      ? err.message
      : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    console.error('[animate] error:', msg);
    return Response.json(
      { error: `Animation failed: ${msg.slice(0, 300)}` },
      { status: 500 },
    );
  }
}
