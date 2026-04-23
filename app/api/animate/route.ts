import { NextRequest } from 'next/server';

export const maxDuration = 60;

const HF_BASE = 'https://router.huggingface.co/hf-inference/models';
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';

const ART_STYLE_MAP: Record<string, string> = {
  '8bit': '8-bit pixel art, NES era, chunky pixels, limited palette',
  '16bit': '16-bit pixel art, SNES era, rich palette',
  '32bit': '32-bit pixel art, PlayStation 1 era',
  'chibi': 'chibi anime style, cute oversized head',
  'vector': 'vector flat art, bold clean outlines',
  'handdrawn': 'hand-drawn ink style',
};

const ANGLE_MAP: Record<string, string> = {
  'front': 'front-facing camera',
  'profile': 'side profile view',
  'three-quarter': 'three-quarter isometric view',
  'topdown': 'top-down overhead view',
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'HUGGINGFACE_API_KEY not configured' }, { status: 500 });
  }

  let body: {
    sourcePrompt?: string;
    animationName?: string;
    artStyle?: string;
    cameraAngle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourcePrompt, animationName, artStyle = '16bit', cameraAngle = 'front' } = body;
  if (!sourcePrompt?.trim() || !animationName?.trim()) {
    return Response.json({ error: 'sourcePrompt and animationName are required' }, { status: 400 });
  }

  const fullPrompt =
    `Pixel art sprite sheet: character — ${sourcePrompt.trim()} — performing animation: ${animationName.trim()}. ` +
    `4 columns × 4 rows grid, 16 sequential animation frames total. ` +
    `Same character in consecutive poses showing smooth ${animationName.trim()} motion. ` +
    `Solid uniform neon green (#00FF00) chroma key background in every cell. ` +
    `${ART_STYLE_MAP[artStyle] ?? artStyle}. ${ANGLE_MAP[cameraAngle] ?? cameraAngle}. ` +
    `Game sprite animation asset. Clean pixel outlines. No text, no labels.`;

  const hfResponse = await fetch(`${HF_BASE}/${HF_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: { num_inference_steps: 4, width: 1024, height: 1024 },
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
          { error: `Model loading, retry in ~${Math.ceil(json.estimated_time)}s.` },
          { status: 503 }
        );
      }
    } else {
      errMsg = await hfResponse.text();
    }
    if (hfResponse.status === 429) {
      return Response.json({ error: 'Rate limit reached. Wait and try again.' }, { status: 429 });
    }
    console.error('[animate] HF error', hfResponse.status, errMsg);
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
