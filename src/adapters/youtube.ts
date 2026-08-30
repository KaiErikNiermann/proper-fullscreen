/*
 * YouTube — verified across default / theater / fullscreen. See docs/findings/20-youtube.md
 */
import { pickVideo, register } from './registry.ts';

const SEL = 'video.html5-main-video, video.video-stream';

register({
  id: 'youtube',
  label: 'YouTube',
  drm: false,
  matches: (h) => /(^|\.)youtube\.com$/.test(h) || h === 'youtu.be',
  cssSelector: SEL,
  findVideo: () => pickVideo(SEL),
  // #movie_player is overflow:hidden and spans the full width while the video is pillarboxed
  // inside it — that asymmetry is exactly what lets the zoom grow horizontally.
  findContainer: () => document.getElementById('movie_player'),
  observeExtra: (apply) => {
    // SPA navigation swaps the video element without a page load.
    const onNav = (): void => { setTimeout(apply, 300); };
    document.addEventListener('yt-navigate-finish', onNav);
    document.addEventListener('yt-player-updated', onNav);
  },
});
