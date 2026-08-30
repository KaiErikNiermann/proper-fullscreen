/*
 * Prime Video — VERIFIED working in real fullscreen. See docs/findings/40-primevideo.md
 *
 * Two things make this site unlike the others:
 *  1. There is NO overflow:hidden ancestor in the player chain, so we have to create the clipping
 *     context ourselves (`needsClip`). Body is overflow:hidden but is the 4264px scroll host.
 *  2. `#dv-web-player.dv-player-fullscreen` is present in BOTH the real-fullscreen and the
 *     CSS-only "fullscreen" state, so that class cannot be used to detect fullscreen.
 */
(function (PF) {
  'use strict';
  const { register, pickVideo, findClippingAncestor } = PF.adapters;

  const SURFACE = '.atvwebplayersdk-video-surface';

  register({
    id: 'primevideo',
    label: 'Prime Video',
    drm: true,
    matches: (h) => /(^|\.)primevideo\.com$/.test(h) || /(^|\.)amazon\.[a-z.]{2,6}$/.test(h),
    // The <video> carries no class and no inline style — Amazon sizes it with width/height
    // ATTRIBUTES ("100%"). Scope by the surface instead.
    cssSelector: `${SURFACE} video`,
    needsClip: SURFACE,
    // Three <video> elements exist on a detail page; two have videoWidth 0 (one is the
    // detail-page preview). pickVideo requires a decoded frame.
    findVideo: () => pickVideo(`${SURFACE} video, #dv-web-player video, video`),
    findContainer: (v) => v.closest(SURFACE) ?? findClippingAncestor(v),
  });
})(globalThis.PF = globalThis.PF || {});
