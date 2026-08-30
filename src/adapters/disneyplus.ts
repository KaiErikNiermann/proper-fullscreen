/* Disney+ — verified. DRM: pixel detection impossible. See docs/findings/10-disneyplus.md */
import { findClippingAncestor, pickVideo, register } from './registry.ts';

const SEL = 'video.btm-media-client-element';

register({
  id: 'disneyplus',
  label: 'Disney+',
  drm: true,
  matches: (h) => /(^|\.)disneyplus\.com$/.test(h) || /(^|\.)star\.disneyplus\.com$/.test(h),
  cssSelector: SEL,
  // Two <video> elements exist; the first is display:none. pickVideo requires a decoded frame.
  findVideo: () => pickVideo(SEL),
  findContainer: (v) => v.closest('.btm-media-client') ?? findClippingAncestor(v),
});
