import { NextRequest } from 'next/server';

export const maxDuration = 60;

const HF_BASE = 'https://router.huggingface.co/hf-inference/models';
const IMG2IMG_MODEL = 'timbrooks/instruct-pix2pix';
const TEXT2IMG_MODEL = 'black-forest-labs/FLUX.1-schnell';

const ART_STYLE_MAP: Record<string, string> = {
  '8bit':       '8-bit pixel art, NES era, chunky pixels, limited palette',
  '16bit':      '16-bit pixel art, SNES era, rich palette, smooth shading',
  '32bit':      '32-bit pixel art, PlayStation 1 era, detailed sprites',
  'chibi':      'chibi anime style, cute oversized head, small body',
  'vector':     'vector flat art, bold clean outlines, flat solid colors',
  'handdrawn':  'hand-drawn ink style, rough organic lines',
};

const ANGLE_MAP: Record<string, string> = {
  'front':         'front-facing view',
  'profile':       'side profile facing right',
  'three-quarter': 'three-quarter isometric perspective',
  'topdown':       'top-down overhead view',
};

/** Try instruct-pix2pix img2img.  Returns image data or null on any failure. */
async function tryImg2Img(
  apiKey: string,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
): Promise<{ imageBase64: string; mimeType: string } | null> {

  const img2imgPrompt =
    `${prompt} ` +
    `The output character must be IDENTICAL to the input character: same colors, same proportions, same art style. ` +
    `Arrange 16 frames in a strict 4×4 grid. Each frame is a separate animation pose of the SAME character. ` +
    `Every character must be FULLY CONTAINED within its own cell, centered, with padding. ` +
    `Solid neon green #00FF00 chroma key background in every cell. No text, no labels.`;

  const negativePrompt =
    'different character, different colors, different style, blurry, cropped, cut off, ' +
    'partial body, missing limbs, distorted, overlapping cells, text, watermark, ' +
    'frame bleeding, character outside cell boundaries';

  // Convert base64 → Buffer → clean base64 (validates the image data is well-formed)
  const cleanBase64 = imageBuffer.toString('base64');

  // ── Attempt A: JSON with base64 ──────────────────────────────────────────
  try {
    const res = await fetch(`${HF_BASE}/${IMG2IMG_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: cleanBase64,
        parameters: {
          prompt: img2imgPrompt,
          negative_prompt: negativePrompt,
          guidance_scale: 7.5,
          image_guidance_scale: 2.5, // High → strongly preserves reference character
          num_inference_steps: 20,
        },
      }),
    });

    if (res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      const buf = await res.arrayBuffer();

      if (ct.startsWith('image/')) {
        console.log('[animate] img2img JSON succeeded', ct);
        return { imageBase64: Buffer.from(buf).toString('base64'), mimeType: ct };
      }

      // Some HF endpoints wrap in JSON
      try {
        const json = JSON.parse(Buffer.from(buf).toString()) as {
          imageBase64?: string; mimeType?: string; error?: string;
        };
        if (json.imageBase64) {
          console.log('[animate] img2img JSON (wrapped) succeeded');
          return { imageBase64: json.imageBase64, mimeType: json.mimeType ?? 'image/jpeg' };
        }
        console.warn('[animate] img2img JSON ok but unexpected body:', json.error ?? ct);
      } catch {
        // body was image bytes but wrong content-type header — treat as image
        console.log('[animate] img2img JSON ok (fallback binary)', ct);
        return { imageBase64: Buffer.from(buf).toString('base64'), mimeType: ct || 'image/jpeg' };
      }
    } else {
      const errBody = await res.text();
      console.warn(`[animate] img2img JSON failed ${res.status}: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[animate] img2img JSON exception:', String(err).slice(0, 150));
  }

  // ── Attempt B: FormData / multipart (some HF endpoints prefer this) ──────
  try {
    const ab = imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: mimeType || 'image/png' });
    const form = new FormData();
    form.append('inputs', blob, 'sprite.png');
    form.append(
      'parameters',
      JSON.stringify({
        prompt: img2imgPrompt,
        negative_prompt: negativePrompt,
        guidance_scale: 7.5,
        image_guidance_scale: 2.5,
        num_inference_steps: 20,
      }),
    );

    const res = await fetch(`${HF_BASE}/${IMG2IMG_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }, // No Content-Type; fetch sets boundary
      body: form,
    });

    if (res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      const buf = await res.arrayBuffer();
      console.log('[animate] img2img FormData succeeded', ct);
      return { imageBase64: Buffer.from(buf).toString('base64'), mimeType: ct || 'image/jpeg' };
    }

    const errBody = await res.text();
    console.warn(`[animate] img2img FormData failed ${res.status}: ${errBody.slice(0, 200)}`);
  } catch (err) {
    console.warn('[animate] img2img FormData exception:', String(err).slice(0, 150));
  }

  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

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
    artStyle = '16bit',
    cameraAngle = 'front',
    spriteImageBase64,
    spriteMimeType,
    sourceSeed,
  } = body;

  if (!sourcePrompt?.trim() || !animationName?.trim()) {
    return Response.json({ error: 'sourcePrompt and animationName are required' }, { status: 400 });
  }

  const styleStr = ART_STYLE_MAP[artStyle] ?? artStyle;
  const angleStr = ANGLE_MAP[cameraAngle] ?? cameraAngle;

  // ── Step 1: img2img using the reference sprite ───────────────────────────
  if (spriteImageBase64?.trim()) {
    // Validate base64 by round-tripping through Buffer
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(spriteImageBase64, 'base64');
      if (imageBuffer.length < 100) throw new Error('image too small');
    } catch (err) {
      console.warn('[animate] invalid spriteImageBase64:', String(err));
      // continue to text2img fallback
      imageBuffer = Buffer.alloc(0);
    }

    if (imageBuffer.length > 0) {
      const basePrompt =
        `Transform into a 4×4 sprite sheet of the character performing ${animationName.trim()} animation. ` +
        `${styleStr}. ${angleStr}.`;

      const result = await tryImg2Img(apiKey, imageBuffer, spriteMimeType ?? 'image/png', basePrompt);
      if (result) return Response.json(result);
    }

    console.log('[animate] all img2img attempts failed, falling back to FLUX text2img');
  }

  // ── Step 2: FLUX text2img fallback (same seed → same character style) ────
  const seed = typeof sourceSeed === 'number'
    ? sourceSeed
    : Math.floor(Math.random() * 2_147_483_647);

  const fullPrompt =
    `Pixel art sprite sheet: ${sourcePrompt.trim()}, ${animationName.trim()} animation. ` +
    `Strict 4-column × 4-row grid, 16 sequential frames, 1024×1024 image, each cell 256×256 px. ` +
    `Character FULLY CONTAINED and CENTERED in every cell, at most 80% of cell area. ` +
    `NO overlap or bleed between cells. Thin visible grid lines between cells. ` +
    `Frames show smooth ${animationName.trim()} motion from frame 1 to 16. ` +
    `Same character appearance in all frames. ` +
    `Solid neon green #00FF00 background every cell. ` +
    `${styleStr}. ${angleStr}. No text. No labels. Clean game asset.`;

  const hfResponse = await fetch(`${HF_BASE}/${TEXT2IMG_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: { num_inference_steps: 4, width: 1024, height: 1024, seed },
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
          { status: 503 },
        );
      }
    } else {
      errMsg = await hfResponse.text();
    }
    if (hfResponse.status === 429) {
      return Response.json({ error: 'Rate limit reached. Wait and try again.' }, { status: 429 });
    }
    console.error('[animate] FLUX error', hfResponse.status, errMsg.slice(0, 200));
    return Response.json(
      { error: `Generation failed (${hfResponse.status}): ${errMsg.slice(0, 200)}` },
      { status: hfResponse.status },
    );
  }

  const mimeType = hfResponse.headers.get('content-type') ?? 'image/jpeg';
  const imageBuffer = await hfResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  return Response.json({ imageBase64, mimeType });
}
