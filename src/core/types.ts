/**
 * Shared domain types.
 */

/**
 * Geometry of a player at one instant. All lengths in CSS px.
 */
export interface Layout {
  /**
   * width of the `overflow:hidden` ancestor that clips
   */
  readonly containerW: number;
  /**
   * height of that ancestor
   */
  readonly containerH: number;
  /**
   * UNTRANSFORMED video layout width (offsetWidth)
   */
  readonly boxW: number;
  /**
   * UNTRANSFORMED video layout height (offsetHeight)
   */
  readonly boxH: number;
  /**
   * videoWidth / videoHeight — the AR actually decoded
   */
  readonly frameAR: number;
  /**
   * AR of the real image inside that frame
   */
  readonly pictureAR: number;
}

export type BoundBy = 'height' | 'width' | 'none';

export interface Solution {
  readonly scale: number;
  readonly scaleH: number;
  readonly scaleW: number;
  readonly boundBy: BoundBy;
  readonly pictureW: number;
  readonly pictureH: number;
  /**
   * black px above/below the picture, per side
   */
  readonly letterbar: number;
  /**
   * black px left/right of the picture, per side
   */
  readonly pillarbar: number;
}

/**
 * Result of trying to express a player's own transform so ours can compose with it.
 */
export type TransformBase =
  | { readonly ok: true; readonly css: string }
  | { readonly ok: false; readonly reason: string };

export interface BarInset {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export type Detection =
  | { readonly ok: true; readonly pictureAR: number; readonly bars: BarInset; readonly samples: number }
  | { readonly ok: false; readonly reason: string };

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly ar: number;
  readonly note: string;
}

export type SettingsSource = `preset:${string}` | 'custom' | 'auto';

export interface SiteSettings {
  readonly enabled: boolean;
  readonly pictureAR: number;
  readonly source: SettingsSource;
}

/**
 * A site adapter answers: which <video>, which ancestor clips, what selector to style.
 */
export interface Adapter {
  readonly id: string;
  readonly label: string;
  /**
   * pixel readback known to be blocked
   */
  readonly drm: boolean;
  readonly matches: (host: string) => boolean;
  /**
   * selector used inside the injected stylesheet
   */
  readonly cssSelector: string;
  readonly findVideo: () => HTMLVideoElement | null;
  readonly findContainer: (v: HTMLVideoElement) => Element | null;
  /**
   * selector needing `overflow: hidden` because the site provides no clipper
   */
  readonly needsClip?: string;
  readonly observeExtra?: (apply: () => void) => void;
}

export interface Status {
  readonly adapter: { id: string; label: string; drm: boolean } | null;
  readonly bound: boolean;
  readonly frame: { w: number; h: number; ar: number } | null;
  readonly settings: SiteSettings;
  readonly solution: Solution | null;
  readonly baseTransform: string;
  readonly canDetect: boolean;
}

export type Message =
  | { readonly type: 'pf:status' }
  | { readonly type: 'pf:detect' };
