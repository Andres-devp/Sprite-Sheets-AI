export type ArtStyle = '8bit' | '16bit' | '32bit' | 'chibi' | 'vector' | 'handdrawn';
export type CameraAngle = 'front' | 'profile' | 'three-quarter' | 'topdown';
export type AppView = 'generate' | 'review' | 'gallery';
export type GalleryFilter = 'all' | 'sprites' | 'spritesheets' | 'animations';

export interface Sprite {
  id: string;
  type: 'sprite';
  name: string;
  prompt: string;
  artStyle: ArtStyle;
  cameraAngle: CameraAngle;
  imageBase64: string;
  mimeType: string;
  createdAt: number;
}

export interface SpriteSheet {
  id: string;
  type: 'spritesheet';
  name: string;            // character name
  animationName: string;   // e.g. "walk cycle"
  sourcePrompt: string;    // original character prompt
  artStyle: ArtStyle;
  cameraAngle: CameraAngle;
  imageBase64: string;
  mimeType: string;
  cols: number;
  rows: number;
  frameSize: number;       // px per frame side (e.g. 256)
  frames?: string[];       // extracted frame data URLs
  createdAt: number;
}

export type GalleryItem = Sprite | SpriteSheet;

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
  selectedForReview: string[];   // sprite IDs selected for Step 2
  galleryFilter: GalleryFilter;
  isGenerating: boolean;
  isAnimating: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'ADD_SPRITE'; payload: Sprite }
  | { type: 'ADD_SPRITESHEET'; payload: SpriteSheet }
  | { type: 'UPDATE_SPRITESHEET_FRAMES'; payload: { id: string; frames: string[] } }
  | { type: 'SET_SELECTED_FOR_REVIEW'; payload: string[] }
  | { type: 'SET_GALLERY_FILTER'; payload: GalleryFilter }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_ANIMATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'DELETE_ITEM'; payload: string };
