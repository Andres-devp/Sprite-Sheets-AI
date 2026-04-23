import { NextRequest } from 'next/server';

export const maxDuration = 60;

// FLUX.1-schnell: free on HF Inference API, 4-step generation, high quality
// Base URL changed in 2025: api-inference.huggingface.co → router.huggingface.co/hf-inference
const HF_BASE = 'https://router.huggingface.co/hf-inference/models';
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';

const ART_STYLE_MAP: Record<string, string> = {
  '8bit': '8-bit pixel art, NES era, very limited color palette, chunky blocky pixels',
  '16bit': '16-bit pixel art, SNES era, rich palette, smooth shading',
  '32bit': '32-bit pixel art, PlayStation 1 era, detailed sprites',
  'chibi': 'chibi style, cute oversized head, small body, anime-inspired',
  'vector': 'vector flat art, bold clean outlines, flat colors',
  'handdrawn': 'hand-drawn ink sketch, rough lines, traditional animation style',
};

const ANGLE_MAP: Record<string, string> = {
  'front': 'front-facing camera angle',
  'profile': 'side profile view facing right',
  'three-quarter': 'three-quarter isometric perspective',
  'topdown': 'top-down overhead view',
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'HUGGINGFACE_API_KEY not configured on server' }, { status: 500 });
  }

  let body: { prompt?: string; artStyle?: string; cameraAngle?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, artStyle = '16bit', cameraAngle = 'front' } = body;
  if (!prompt?.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Single character sprite — NOT a sprite sheet
  const fullPrompt =
    `Single full-body character sprite, centered on a solid neon green (#00FF00) chroma key background. ` +
    `Character: ${prompt.trim()}. ` +
    `Art style: ${ART_STYLE_MAP[artStyle] ?? artStyle}. ` +
    `Camera: ${ANGLE_MAP[cameraAngle] ?? cameraAngle}. ` +
    `Complete character fully visible, clean pixel outlines, no other objects, no scene background. ` +
    `Game sprite asset, idle standing pose.`;

  const hfResponse = await fetch(`${HF_BASE}/${HF_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: {
        num_inference_steps: 4, // FLUX-schnell is optimized for 1–4 steps
        width: 1024,
        height: 1024,
      },
    }),
  });

  if (!hfResponse.ok) {
    const ct = hfResponse.headers.get('content-type') ?? '';
    let errMsg = '';

    if (ct.includes('application/json')) {
      const json = await hfResponse.json() as { error?: string; estimated_time?: number };
      errMsg = json.error ?? JSON.stringify(json);

      if (hfResponse.status === 503 && json.estimated_time) {
        return Response.json(
          { error: `Model is loading, please retry in ~${Math.ceil(json.estimated_time)}s.` },
          { status: 503 }
        );
      }
    } else {
      errMsg = await hfResponse.text();
    }

    if (hfResponse.status === 429) {
      return Response.json(
        { error: 'Rate limit reached. Wait a moment and try again.' },
        { status: 429 }
      );
    }

    console.error('[generate] HF error', hfResponse.status, errMsg);
    return Response.json(
      { error: `Generation failed (${hfResponse.status}): ${errMsg.slice(0, 200)}` },
      { status: hfResponse.status }
    );
  }

  const mimeType = hfResponse.headers.get('content-type') ?? 'image/jpeg';
  const imageBuffer = await hfResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  return Response.json({ imageBase64, mimeType });
}
