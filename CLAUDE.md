# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands

```bash
npm run dev    # Start dev server (http://localhost:3000)
npm run build  # Production build
npm run lint   # ESLint
npm start      # Run production server after build
```

## Architecture

### State Management

Single `useReducer` in `app/page.tsx` (root component). State persisted to localStorage key `spritesheet-v2`. No external state library.

```typescript
AppState = {
  currentView: AppView,      // 'video' | 'generate' | 'review' | 'animate' | 'gallery'
  sprites: Sprite[],         // AI-generated sprites
  spriteSheets: SpriteSheet[],
  selectedForReview: string[],
  selectedSheetId: string | null,
  galleryFilter: GalleryFilter,
  isGenerating: boolean,
  isAnimating: boolean,
  error: string | null
}
```

### AppView Navigation

Five views share a reducer pattern. `video` view is the landing view. `review` and `animate` are sub-states of `generate` — nav resolves via `resolveActiveNav()`. Sidebar persists recent items across sessions.

### Data Flow

1. **Video to Sprite**: `VideoToSprite` extracts frames client-side via `extractVideoFrames()` (HTMLVideoElement + Canvas). Chroma key applied via `applyChromaKey()`. Export as ZIP (frames) or grid PNG.
2. **AI Generate**: POST to `/api/generate` → Google Generative AI → returns sprite data → `ADD_SPRITE` action.
3. **Review**: Select sprites → `ADD_SPRITESHEET` → transition to `animate` view.
4. **Animate**: Sprite sheet → frame splitting → CSS/canvas animation preview.
5. **Gallery**: Unified view for sprites and sprite sheets. Chroma key modal for background removal.

### Key Files

- `app/page.tsx` — root component, reducer, state init, view routing
- `app/api/generate/route.ts` — AI sprite generation endpoint
- `app/api/animate/route.ts` — sprite sheet animation endpoint
- `lib/videoExtract.ts` — client-side frame extraction (HTMLVideoElement seek + canvas capture)
- `lib/chromaKey.ts` — server-side chroma key (pixel threshold + erosion + edge softness)
- `lib/spriteExtract.ts` — sprite sheet frame splitting
- `types/index.ts` — all TypeScript types
- `components/` — UI components (Sidebar, GeneratePanel, ReviewPanel, AnimatePanel, Gallery, VideoToSprite, VideoRightSidebar, ChromaKeyModal, ExportModal, AnimatePanel)

### Theming

CSS custom properties defined in `app/globals.css`. No Tailwind config-based theming. Properties: `--sidebar-*`, `--background`, `--foreground`, `--muted-*`, `--accent-*`, `--primary`.

### API Design

- `POST /api/generate` — body: `{ prompt, artStyle, cameraAngle }` → `{ sprite: { id, imageBase64, ... } }`
- `POST /api/animate` — body: `{ spriteSheetId, animationName }` → updates SpriteSheet with frames

### Constraints

- `extractVideoFrames()` is client-only (checks `typeof window === 'undefined'`)
- AI endpoints require `@google/generative-ai` — API key needed in environment
- Sprite/sprite sheet images stored as base64 in localStorage — size limit applies
