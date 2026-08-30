/*
 * Fixtures are REAL measurements taken from the live players (see docs/findings/). If a change to
 * the solver breaks one of these, it breaks a case that was verified by eye in the browser.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyTransform, isWorthApplying, solve } from '../src/core/geometry.ts';
import type { BoundBy, Layout } from '../src/core/types.ts';

const YT = 1920 / 1080;   // 1.77778
const DP = 853 / 480;     // 1.77708
const PV = 960 / 540;     // 1.77778
const NF = 1280 / 720;    // 1.77778
const SCOPE = 2.39;

interface Case {
  readonly name: string;
  readonly layout: Layout;
  readonly scale: number;
  readonly boundBy: BoundBy;
}

const CASES: readonly Case[] = [
  // --- YouTube, verified across all three view modes -------------------------------
  { name: 'youtube default (16:9 box — must refuse to zoom)',
    layout: { containerW: 1806, containerH: 1015.8, boxW: 1806, boxH: 1016, frameAR: YT, pictureAR: SCOPE },
    scale: 1, boundBy: 'none' },
  { name: 'youtube theater',
    layout: { containerW: 2981.3, containerH: 962.9, boxW: 1712, boxH: 963, frameAR: YT, pictureAR: SCOPE },
    scale: 1.3442, boundBy: 'height' },
  { name: 'youtube fullscreen',
    layout: { containerW: 2981.3, containerH: 1248, boxW: 2219, boxH: 1248, frameAR: YT, pictureAR: SCOPE },
    scale: 1.3435, boundBy: 'width' },

  // --- Disney+ (DRM), windowed — the state confirmed working by the user ------------
  { name: 'disney+ windowed',
    layout: { containerW: 2981.33, containerH: 1131.87, boxW: 2981, boxH: 1132, frameAR: DP, pictureAR: SCOPE },
    scale: 1.3448, boundBy: 'height' },

  // --- Prime Video (DRM), both fullscreen modes ------------------------------------
  { name: 'prime real fullscreen',
    layout: { containerW: 2981.3, containerH: 1248, boxW: 2981, boxH: 1248, frameAR: PV, pictureAR: SCOPE },
    scale: 1.34375, boundBy: 'width' },
  { name: 'prime css-fullscreen (container narrower than 16:9 — must refuse)',
    layout: { containerW: 1848.6, containerH: 1072.9, boxW: 1849, boxH: 1073, frameAR: PV, pictureAR: SCOPE },
    scale: 1, boundBy: 'none' },

  // --- Netflix (DRM): the video box is TALLER than its container ---------------------
  { name: 'netflix fullscreen (player already oversizes the box)',
    layout: { containerW: 2981.3, containerH: 1248, boxW: 2981, boxH: 1327, frameAR: NF, pictureAR: SCOPE },
    scale: 1.26375, boundBy: 'width' },
];

for (const c of CASES) {
  test(c.name, () => {
    const s = solve(c.layout);
    assert.ok(Math.abs(s.scale - c.scale) < 0.002, `scale ${s.scale.toFixed(5)} != ${c.scale}`);
    assert.equal(s.boundBy, c.boundBy);
    // Never overflow the clipper: that is the bug that cropped 25.6% of image width.
    assert.ok(s.pictureW <= c.layout.containerW + 0.5, `pictureW ${s.pictureW} overflows`);
    assert.ok(s.pictureH <= c.layout.containerH + 0.5, `pictureH ${s.pictureH} overflows`);
  });
}

test('never shrinks below 1', () => {
  const s = solve({ containerW: 800, containerH: 200, boxW: 800, boxH: 450, frameAR: 16 / 9, pictureAR: 1.33 });
  assert.equal(s.scale, 1);
});

test('pillarboxed content (4:3 in 16:9) is handled by the same clamp', () => {
  const s = solve({ containerW: 2981.3, containerH: 1248, boxW: 2219, boxH: 1248, frameAR: 16 / 9, pictureAR: 4 / 3 });
  assert.equal(s.scale, 1, 'picture already fills height — zooming would only crop');
});

test('a 2.39 film on a 2.39 screen fills it exactly', () => {
  const s = solve({ containerW: 2390, containerH: 1000, boxW: 1778, boxH: 1000, frameAR: 16 / 9, pictureAR: 2.39 });
  assert.ok(Math.abs(s.pictureW - 2390) < 2, `pictureW ${s.pictureW}`);
  assert.ok(Math.abs(s.letterbar) < 2 && Math.abs(s.pillarbar) < 2);
});

test('a native-AR encode needs no zoom at all', () => {
  // Netflix ships both padded and native masters; the native ones must be left alone. Sub-pixel
  // container/box rounding leaves scale a hair above 1, which is exactly what isWorthApplying
  // exists to swallow — asserting on it is the meaningful check, not on scale === 1.
  const s = solve({ containerW: 2981.3, containerH: 1248, boxW: 2981, boxH: 1248, frameAR: 2.39, pictureAR: 2.39 });
  assert.ok(s.scale < 1.005, `scale ${s.scale}`);
  assert.equal(isWorthApplying(s), false, 'must not spend a compositor layer on a no-op');
});

/* --- native transform composition -------------------------------------------------------
 * Replacing a player's transform instead of composing with it is what throws the picture into
 * the bottom-right corner. The Netflix matrix below is a real reading from the live player.
 */
test('no transform composes to nothing', () => {
  assert.deepEqual(classifyTransform('none', 100, 100), { ok: true, css: '' });
});

test('identity matrix composes to nothing', () => {
  assert.deepEqual(classifyTransform('matrix(1, 0, 0, 1, 0, 0)', 100, 100), { ok: true, css: '' });
});

test('netflix centring translate is re-expressed as percentages', () => {
  // measured live: position:absolute; top:624px; left:1490.67px on a 2981.33x1327 box
  const r = classifyTransform('matrix(1, 0, 0, 1, -1490.67, -663.5)', 2981.33, 1327);
  assert.ok(r.ok);
  assert.equal(r.css, 'translate(-50%, -50%)', 'must survive a resize');
});

test('an arbitrary translate is preserved verbatim', () => {
  const r = classifyTransform('matrix(1, 0, 0, 1, -40, -12)', 1000, 500);
  assert.ok(r.ok);
  assert.equal(r.css, 'translate(-40px, -12px)');
});

test('a transform that already scales is refused rather than composed', () => {
  assert.equal(classifyTransform('matrix(1.5, 0, 0, 1.5, 0, 0)', 100, 100).ok, false);
});

test('a rotation is refused', () => {
  assert.equal(classifyTransform('matrix(0, 1, -1, 0, 0, 0)', 100, 100).ok, false);
});

test('garbage is refused', () => {
  assert.equal(classifyTransform('perspective(4px)', 100, 100).ok, false);
});
