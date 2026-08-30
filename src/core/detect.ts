/* eslint-disable security/detect-object-injection --
   The flagged accesses are integer indices into a Uint8ClampedArray of pixel data, computed
   locally from loop counters. None is user input. */
/*
 * Letterbox detection by pixel readback. Works only on unprotected video (YouTube). Under
 * Widevine, drawImage yields an all-black surface and throws NOTHING — so success must be proven
 * by finding actual luma, never by the absence of an exception.
 */
import { makeLogger } from './logger.ts';
import type { BarInset, Detection } from './types.ts';

const log = makeLogger('detect');

const LUMA_T = 24;        // per-pixel "not black" threshold
const ROW_FRAC = 0.005;   // fraction of a row that must be lit for it to count as picture
const SAMPLE_POINTS: readonly number[] = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];

/**
 * Peak luma over a coarse sample. Zero means DRM zeroed the surface (or a genuinely black frame).
 */
function peakLuma(data: Uint8ClampedArray, stride: number): number {
  let max = 0;
  for (let index = 0; index + 2 < data.length; index += 4 * stride) {
    const r = data[index] ?? 0, g = data[index + 1] ?? 0, b = data[index + 2] ?? 0;
    const m = Math.max(r, g, b);
    if (m > max) max = m;
  }
  return max;
}

/**
 * Whether pixel readback actually yields image data for this element.
 */
export function canRead(v: HTMLVideoElement): boolean {
  if (!v.videoWidth || !v.videoHeight) return false;
  try {
    const c = document.createElement('canvas');
    c.width = Math.min(v.videoWidth, 320);
    c.height = Math.min(v.videoHeight, 180);
    const context = c.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(v, 0, 0, c.width, c.height);
    return peakLuma(context.getImageData(0, 0, c.width, c.height).data, 13) > LUMA_T;
  } catch (error) {
    log.debug('readback threw', error);
    return false;
  }
}

/**
 * Scan one drawn frame for bar thickness on all four edges.
 */
function scanFrame(context: CanvasRenderingContext2D, W: number, H: number): BarInset {
  const d = context.getImageData(0, 0, W, H).data;
  const isLit = (x: number, y: number): boolean => {
    const index = (y * W + x) * 4;
    return Math.max(d[index] ?? 0, d[index + 1] ?? 0, d[index + 2] ?? 0) > LUMA_T;
  };
  const isRowLit = (y: number): boolean => {
    let n = 0;
    for (let x = 0; x < W; x += 2) if (isLit(x, y)) n++;
    return n >= (W / 2) * ROW_FRAC;
  };
  const isColLit = (x: number): boolean => {
    let n = 0;
    for (let y = 0; y < H; y += 2) if (isLit(x, y)) n++;
    return n >= (H / 2) * ROW_FRAC;
  };

  let top = 0; while (top < H && !isRowLit(top)) top++;
  let bottom = 0; while (bottom < H && !isRowLit(H - 1 - bottom)) bottom++;
  let left = 0; while (left < W && !isColLit(left)) left++;
  let right = 0; while (right < W && !isColLit(W - 1 - right)) right++;
  return { top, bottom, left, right };
}

const seek = (v: HTMLVideoElement, t: number): Promise<void> => new Promise<void>((resolve) => {
  const h = (): void => { v.removeEventListener('seeked', h); resolve(); };
  v.addEventListener('seeked', h);
  v.currentTime = t;
});

const twoFrames = (): Promise<void> =>
  new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(() => { r(); }); }); });

/**
 * Draw and scan each timestamp in turn.
 */
async function sampleFrames(
  v: HTMLVideoElement, context: CanvasRenderingContext2D,
  W: number, H: number, points: readonly number[], isSeekable: boolean,
): Promise<readonly BarInset[]> {
  const out: BarInset[] = [];
  for (const t of points) {
    if (isSeekable) { await seek(v, t); await twoFrames(); }
    context.drawImage(v, 0, 0, W, H);
    out.push(scanFrame(context, W, H));
  }
  return out;
}

/**
 * Put playback back exactly where it was. Best effort — never throws.
 */
async function restore(v: HTMLVideoElement, t0: number, wasPaused: boolean, isSeekable: boolean): Promise<void> {
  if (isSeekable) { try { await seek(v, t0); } catch { /* best effort */ } }
  if (!wasPaused && v.paused) { try { await v.play(); } catch { /* autoplay policy */ } }
}

/**
 * Sample several timestamps and keep the MINIMUM bar on each edge. A dark scene reads as a false
 * bar, so a single frame is never trustworthy; the minimum is the safe consensus. Restores
 * currentTime and paused state afterwards.
 */
export async function detect(v: HTMLVideoElement): Promise<Detection> {
  const W = v.videoWidth, H = v.videoHeight;
  if (!W || !H) return { ok: false, reason: 'no frame yet' };
  if (!canRead(v)) return { ok: false, reason: 'pixel readback blocked (DRM) or frame is black' };

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const context = c.getContext('2d', { willReadFrequently: true });
  if (!context) return { ok: false, reason: 'no 2d context' };

  const t0 = v.currentTime;
  const wasPaused = v.paused;
  const dur = v.duration;
  const isSeekable = Number.isFinite(dur) && dur > 2;
  const points = isSeekable ? SAMPLE_POINTS.map((f) => dur * f) : [t0];

  let results: readonly BarInset[];
  try {
    results = await sampleFrames(v, context, W, H, points, isSeekable);
  } catch (error) {
    log.warn('sampling failed', error);
    return { ok: false, reason: String(error) };
  } finally {
    await restore(v, t0, wasPaused, isSeekable);
  }

  const bars: BarInset = {
    top: Math.min(...results.map((r) => r.top)),
    bottom: Math.min(...results.map((r) => r.bottom)),
    left: Math.min(...results.map((r) => r.left)),
    right: Math.min(...results.map((r) => r.right)),
  };
  const cw = W - bars.left - bars.right;
  const ch = H - bars.top - bars.bottom;
  if (cw <= 0 || ch <= 0) return { ok: false, reason: 'frame reads as fully black' };

  log.debug('samples', results, '->', bars);
  return { ok: true, pictureAR: cw / ch, bars, samples: results.length };
}
