/*
 * Netflix — verified. See docs/findings/50-netflix.md
 *
 * The one that bites: Netflix centres its <video> with `position:absolute; top/left` in px plus a
 * compensating `transform: translate(-50%, -50%)`. Replacing that transform rather than composing
 * with it throws the picture into the bottom-right corner. Handled generically by the engine.
 */
import { findClippingAncestor, pickVideo, register } from './registry.ts';

register({
  id: 'netflix',
  label: 'Netflix',
  drm: true,
  matches: (h) => /(^|\.)netflix\.com$/.test(h),
  // The <video> carries no class and no id; scope by the player view instead.
  cssSelector: '.watch-video video',
  findVideo: () => pickVideo('.watch-video video, video'),
  // The tightest clipper is a DIV whose id is the numeric title id, so it cannot be selected by
  // name — walk for it. `.watch-video--player-view` is the stable fallback.
  findContainer: (v) => findClippingAncestor(v) ?? v.closest('.watch-video--player-view'),
});
