/* Disney+ — verified working. DRM: pixel detection is impossible. See docs/findings/10-disneyplus.md */
(function (PF) {
  'use strict';
  const { register, pickVideo } = PF.adapters;

  register({
    id: 'disneyplus',
    label: 'Disney+',
    drm: true,
    matches: (h) => /(^|\.)disneyplus\.com$/.test(h) || /(^|\.)star\.disneyplus\.com$/.test(h),
    cssSelector: 'video.btm-media-client-element',
    // Two <video> elements exist; the first is display:none. pickVideo requires a decoded frame.
    findVideo: () => pickVideo('video.btm-media-client-element'),
    findContainer: (v) => v.closest('.btm-media-client') ?? PF.adapters.findClippingAncestor(v),
  });
})(globalThis.PF = globalThis.PF || {});
