/*
 * Letterbox detection by pixel readback. Works only on unprotected video (YouTube). Under
 * Widevine, drawImage yields an all-black surface and throws NOTHING — so success must be
 * proven by finding actual luma, never by the absence of an exception.
 */
(function (PF) {
  'use strict';
  const log = PF.log.make('detect');

  const LUMA_T = 24;        // per-pixel "not black" threshold
  const ROW_FRAC = 0.005;   // fraction of a row that must be lit for it to count as picture
  const SAMPLE_POINTS = [0.10, 0.25, 0.40, 0.55, 0.70, 0.85];

  /**
   * @typedef {Object} Detection
   * @property {boolean} ok
   * @property {string} [reason]
   * @property {number} [pictureAR]
   * @property {number} [top]
   * @property {number} [bottom]
   * @property {number} [left]
   * @property {number} [right]
   * @property {number} [samples]
   */

  /** @param {HTMLVideoElement} v @returns {boolean} */
  function canRead(v) {
    const W = v.videoWidth, H = v.videoHeight;
    if (!W || !H) return false;
    try {
      const c = document.createElement('canvas');
      c.width = Math.min(W, 320);
      c.height = Math.min(H, 180);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let maxLuma = 0;
      for (let i = 0; i < d.length; i += 4 * 13) {
        const m = Math.max(d[i], d[i + 1], d[i + 2]);
        if (m > maxLuma) maxLuma = m;
      }
      return maxLuma > LUMA_T;   // all-black => DRM-blocked (or a genuinely black frame)
    } catch (e) {
      log.debug('readback threw', e);
      return false;
    }
  }

  /** Scan one drawn frame for bar thickness on all four edges. */
  function scanFrame(ctx, W, H) {
    const d = ctx.getImageData(0, 0, W, H).data;
    const rowLit = (y) => {
      let n = 0;
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        if (Math.max(d[i], d[i + 1], d[i + 2]) > LUMA_T) n++;
      }
      return n >= (W / 2) * ROW_FRAC;
    };
    const colLit = (x) => {
      let n = 0;
      for (let y = 0; y < H; y += 2) {
        const i = (y * W + x) * 4;
        if (Math.max(d[i], d[i + 1], d[i + 2]) > LUMA_T) n++;
      }
      return n >= (H / 2) * ROW_FRAC;
    };
    let top = 0; while (top < H && !rowLit(top)) top++;
    let bottom = 0; while (bottom < H && !rowLit(H - 1 - bottom)) bottom++;
    let left = 0; while (left < W && !colLit(left)) left++;
    let right = 0; while (right < W && !colLit(W - 1 - right)) right++;
    return { top, bottom, left, right };
  }

  const seek = (v, t) => new Promise((res) => {
    const h = () => { v.removeEventListener('seeked', h); res(); };
    v.addEventListener('seeked', h);
    v.currentTime = t;
  });
  const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  /**
   * Sample several timestamps and keep the MINIMUM bar on each edge. A dark scene reads as a
   * false bar, so a single frame is never trustworthy; the minimum is the safe consensus.
   * Restores currentTime and paused state afterwards.
   *
   * @param {HTMLVideoElement} v
   * @returns {Promise<Detection>}
   */
  async function detect(v) {
    const W = v.videoWidth, H = v.videoHeight;
    if (!W || !H) return { ok: false, reason: 'no frame yet' };
    if (!canRead(v)) return { ok: false, reason: 'pixel readback blocked (DRM) or frame is black' };

    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'no 2d context' };

    const t0 = v.currentTime;
    const wasPaused = v.paused;
    const dur = v.duration;
    const seekable = Number.isFinite(dur) && dur > 2;

    const results = [];
    try {
      const points = seekable ? SAMPLE_POINTS.map((f) => dur * f) : [t0];
      for (const t of points) {
        if (seekable) { await seek(v, t); await twoFrames(); }
        ctx.drawImage(v, 0, 0, W, H);
        results.push(scanFrame(ctx, W, H));
      }
    } catch (e) {
      log.warn('sampling failed', e);
      return { ok: false, reason: String(e) };
    } finally {
      if (seekable) { try { await seek(v, t0); } catch { /* best effort */ } }
      if (!wasPaused && v.paused) { try { await v.play(); } catch { /* autoplay policy */ } }
    }

    const mn = (k) => Math.min(...results.map((r) => r[k]));
    const top = mn('top'), bottom = mn('bottom'), left = mn('left'), right = mn('right');
    const cw = W - left - right;
    const ch = H - top - bottom;
    if (cw <= 0 || ch <= 0) return { ok: false, reason: 'frame reads as fully black' };

    log.debug('samples', results, '->', { top, bottom, left, right });
    return { ok: true, pictureAR: cw / ch, top, bottom, left, right, samples: results.length };
  }

  PF.detect = { detect, canRead };
})(globalThis.PF = globalThis.PF || {});
