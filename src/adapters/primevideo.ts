/*
 * Prime Video — verified in real fullscreen. See docs/findings/40-primevideo.md
 *
 * Two things make this site unlike the others:
 *  1. There is NO overflow:hidden ancestor in the player chain, so we create the clipping context
 *     ourselves via `needsClip`. <body> is overflow:hidden but is the 4264px scroll host.
 *  2. `#dv-web-player.dv-player-fullscreen` is present in BOTH the real-fullscreen and the
 *     CSS-only "fullscreen" state, so that class cannot be used to detect fullscreen.
 */
import { findClippingAncestor, pickVideo, register } from './registry.ts';

const SURFACE = '.atvwebplayersdk-video-surface';

register({
  id: 'primevideo',
  label: 'Prime Video',
  drm: true,
  // Served from amazon.<tld> for most non-US users, not just primevideo.com.
  matches: (h) => /(^|\.)primevideo\.com$/.test(h) || /(^|\.)amazon\.[a-z.]{2,6}$/.test(h),
  // The <video> carries no class and no inline style — Amazon sizes it with width/height
  // ATTRIBUTES ("100%"). Scope by the surface instead.
  cssSelector: `${SURFACE} video`,
  needsClip: SURFACE,
  findVideo: () => pickVideo(`${SURFACE} video, #dv-web-player video, video`),
  findContainer: (v) => v.closest(SURFACE) ?? findClippingAncestor(v),
});
