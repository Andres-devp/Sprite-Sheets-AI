export type ArtStyle = '8bit' | '16bit' | '32bit' | 'chibi' | 'vector' | 'handdrawn';
export type CameraAngle = 'front' | 'profile' | 'three-quarter' | 'topdown';
export type AppView = 'generate' | 'review' | 'animate' | 'gallery' | 'video';
export type GalleryFilter = 'all' | 'sprites' | 'spritesheets' | 'animations';

export interface PendingVideoResult {
  videoBase64: string;
  videoMimeType: string;
  animationName: string;
  spriteName: string;
  spriteImageBase64: string;
  spriteMimeType: string;
  sheetImageBase64?: string;
  sheetMimeType?: string;
  sheetCols?: number;
  sheetRows?: number;
}

export interface Sprite {
  id: string;
  type: 'sprite';
  name: string;
  prompt: string;
  artStyle: ArtStyle;
  cameraAngle: CameraAngle;
  imageBase64: string;
  mimeType: string;
  seed?: number;
  createdAt: number;
}

export interface SpriteSheet {
  id: string;
  type: 'spritesheet';
  name: string;
  animationName: string;
  sourcePrompt: string;
  artStyle: ArtStyle;
  cameraAngle: CameraAngle;
  imageBase64: string;
  mimeType: string;
  cols: number;
  rows: number;
  frameSize: number;
  frames?: string[];
  createdAt: number;
}

// AI-generated animation video — session-only, NOT persisted to localStorage (too large)
export interface Animation {
  id: string;
  type: 'animation';
  name: string;           // character/sprite name
  animationName: string;  // e.g. "Walk Cycle"
  imageBase64: string;    // sprite thumbnail (for display in gallery/sidebar)
  mimeType: string;       // sprite image mime type
  videoBase64: string;    // the AI-generated video
  videoMimeType: string;
  artStyle: ArtStyle;
  cameraAngle: CameraAngle;
  createdAt: number;
}

export type GalleryItem = Sprite | SpriteSheet | Animation;

export interface ChromaKeySettings {
  targetColor: [number, number, number];
  tolerance: number;
  erosion: number;
  edgeSoftness: number;
}

export interface AppState {
  currentView: AppView;
  sprites: Sprite[];
  spriteSheets: SpriteSheet[];
  animations: Animation[];          // session-only
  selectedForReview: string[];
  selectedSheetId: string | null;
  galleryFilter: GalleryFilter;
  isGenerating: boolean;
  isAnimating: boolean;
  error: string | null;
  pendingVideoResult: PendingVideoResult | null;
}

export type AppAction =
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'ADD_SPRITE'; payload: Sprite }
  | { type: 'ADD_SPRITESHEET'; payload: SpriteSheet }
  | { type: 'ADD_ANIMATION'; payload: Animation }
  | { type: 'UPDATE_SPRITESHEET_FRAMES'; payload: { id: string; frames: string[] } }
  | { type: 'SET_SELECTED_FOR_REVIEW'; payload: string[] }
  | { type: 'SET_SELECTED_SHEET'; payload: string | null }
  | { type: 'SET_GALLERY_FILTER'; payload: GalleryFilter }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_ANIMATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'SET_PENDING_VIDEO'; payload: PendingVideoResult | null }
  | { type: 'LOAD_FROM_STORAGE'; payload: { sprites: Sprite[]; spriteSheets: SpriteSheet[] } };
