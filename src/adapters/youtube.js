/* YouTube — verified working across default / theater / fullscreen. See docs/findings/20-youtube.md */
(function (PF) {
  'use strict';
  const { register, pickVideo } = PF.adapters;

  register({
    id: 'youtube',
    label: 'YouTube',
    drm: false,
    matches: (h) => /(^|\.)youtube\.com$/.test(h) || h === 'youtu.be',
    cssSelector: 'video.html5-main-video, video.video-stream',
    findVideo: () => pickVideo('video.html5-main-video, video.video-stream'),
    // #movie_player is overflow:hidden and spans the full width while the video is pillarboxed
    // inside it — that asymmetry is exactly what lets the zoom grow horizontally.
    findContainer: () => document.getElementById('movie_player'),
    observeExtra: (apply) => {
      // SPA navigation swaps the video element without a page load.
      const onNav = () => setTimeout(apply, 300);
      document.addEventListener('yt-navigate-finish', onNav);
      document.addEventListener('yt-player-updated', onNav);
      return () => {
        document.removeEventListener('yt-navigate-finish', onNav);
        document.removeEventListener('yt-player-updated', onNav);
      };
    },
  });
})(globalThis.PF = globalThis.PF || {});
