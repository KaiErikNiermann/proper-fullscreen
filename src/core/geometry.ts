/**
 * The scaling maths. Pure functions, no DOM — the piece that must not be duplicated per-adapter,
 * and the piece worth testing in isolation.
 */
import type { BoundBy, Layout, Solution, TransformBase } from './types.ts';

/**
 * Solve for the largest scale that removes baked-in bars without overflowing the clipping
 * container. Clamping by BOTH axes is essential: bounding by height alone crops the sides
 * (measured on YouTube default mode: 311px lost per side, 25.6% of image width).
 *
 * The frame is first fitted into the box under `object-fit: contain`, giving $fit_w \times fit_h$.
 * The picture inside that frame spans the full width when it is wider than the frame (letterboxed)
 * and the full height otherwise (pillarboxed). The answer is then
 * $s = \max(1, \min(container_h / pict_h,\; container_w / pict_w))$.
 */
export function solve(layout: Layout): Solution {
  const { containerW, containerH, boxW, boxH, frameAR, pictureAR } = layout;

  const fitH = Math.min(boxH, boxW / frameAR);
  const fitW = fitH * frameAR;

  // picture inside the decoded frame, before scaling
  const isLetterboxed = pictureAR >= frameAR;
  const pw0 = isLetterboxed ? fitW : fitH * pictureAR;
  const ph0 = isLetterboxed ? fitW / pictureAR : fitH;

  const scaleH = containerH / ph0;
  const scaleW = containerW / pw0;
  const scale = Math.max(1, Math.min(scaleH, scaleW));

  let boundBy: BoundBy = 'none';
  if (scale !== 1) boundBy = scaleH <= scaleW ? 'height' : 'width';

  const pictureW = pw0 * scale;
  const pictureH = ph0 * scale;

  return {
    scale,
    scaleH,
    scaleW,
    boundBy,
    pictureW,
    pictureH,
    letterbar: Math.max(0, (containerH - pictureH) / 2),
    pillarbar: Math.max(0, (containerW - pictureW) / 2),
  };
}

/**
 * Below ~0.5% the transform costs a compositor layer for nothing.
 */
export const isWorthApplying = (s: Solution): boolean => s.scale > 1.005;

const NEAR = 1e-3;

/**
 * Express the player's own transform as something we can safely PREPEND to our scale.
 *
 * Only pure translations are supported. Netflix centres its <video> with `translate(-50%, -50%)`
 * written out in px; replacing that transform instead of composing with it throws the picture into
 * the bottom-right corner. Anything containing a scale or rotation would compose unpredictably, so
 * we refuse to zoom rather than break the layout.
 *
 * @param t computed transform string
 * @param w element border-box width
 * @param h element border-box height
 */
export function classifyTransform(t: string, w: number, h: number): TransformBase {
  if (t === '' || t === 'none') return { ok: true, css: '' };

  const m = /^matrix\(([^)]+)\)$/.exec(t);
  if (!m?.[1]) return { ok: false, reason: t };

  const n = m[1].split(',').map(Number);
  if (n.length !== 6 || n.some((x) => !Number.isFinite(x))) return { ok: false, reason: t };
  // matrix(a, b, c, d, tx, ty) — a..d are the linear part, tx/ty the translation.
  const [a, b, c, d, tx, ty] = n as [number, number, number, number, number, number];

  const isPureTranslate = Math.abs(a - 1) < NEAR && Math.abs(b) < NEAR
    && Math.abs(c) < NEAR && Math.abs(d - 1) < NEAR;
  if (!isPureTranslate) return { ok: false, reason: t };

  if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return { ok: true, css: '' };

  // The centring idiom: translate(-50%, -50%) expressed in px. Re-emit it as percentages so it
  // stays correct when the box is resized.
  return ({ ok: true, css: Math.abs(tx + w / 2) < 1.5 && Math.abs(ty + h / 2) < 1.5 ? 'translate(-50%, -50%)' : `translate(${tx}px, ${ty}px)` });
}
