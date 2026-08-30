/*
 * Netflix — UNVERIFIED (needs login). Selectors are best-effort; the generic clipping-ancestor
 * walk is the safety net if `findContainer` misses.
 */
(function (PF) {
  'use strict';
  const { register, pickVideo, findClippingAncestor } = PF.adapters;

  register({
    id: 'netflix',
    label: 'Netflix',
    drm: true,
    matches: (h) => /(^|\.)netflix\.com$/.test(h),
    cssSelector: '.watch-video video, .VideoContainer video, video',
    findVideo: () => pickVideo('.watch-video video, .VideoContainer video, video'),
    findContainer: (v) => v.closest('.watch-video--player-view')
      ?? v.closest('.VideoContainer')
      ?? findClippingAncestor(v),
  });
})(globalThis.PF = globalThis.PF || {});
