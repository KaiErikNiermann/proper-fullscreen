/*
 * Lifecycle: bind to a player, inject the stylesheet, keep the scale correct across every layout
 * change. All site-specific knowledge lives in adapters; all maths lives in geometry.
 */
(function (PF) {
  'use strict';
  const log = PF.log.make('engine');
  const STYLE_ID = 'proper-fullscreen-style';
  const VAR = '--pf-scale';
  const SETTLE_MS = 350;   // fullscreen reports a transitional box before the window finishes

  /** @type {{adapter: any, video: HTMLVideoElement|null, container: Element|null}} */
  const bound = { adapter: null, video: null, container: null };
  let settings = { enabled: true, pictureAR: PF.presets.DEFAULT_AR };
  let ro = null;
  let cleanupExtra = null;
  let lastSolution = null;

  /**
   * The stylesheet is injected once and left alone. Never write the video's inline `style`:
   * every player tested owns that attribute and rewrites it (YouTube on every resize, Disney+ on
   * mount). A rule in <head> is outside their diff and survives re-renders.
   */
  function ensureStyle(adapter) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    const extraClip = adapter.needsClip
      ? `${adapter.needsClip} { overflow: hidden !important; }\n`
      : '';
    const css = `${extraClip}${adapter.cssSelector} {
  transform: scale(var(${VAR}, 1)) !important;
  transform-origin: 50% 50% !important;
}`;
    if (el.textContent !== css) el.textContent = css;
    return el;
  }

  function setScale(s) {
    document.documentElement.style.setProperty(VAR, s.toFixed(5));
  }

  /** Resolve video + container for the current page. */
  function rebind() {
    const adapter = bound.adapter;
    if (!adapter) return false;
    const video = adapter.findVideo ? adapter.findVideo() : PF.adapters.pickVideo(adapter.cssSelector);
    if (!video || !video.videoWidth) { bound.video = null; return false; }
    const container = (adapter.findContainer && adapter.findContainer(video))
      || PF.adapters.findClippingAncestor(video);
    if (!container) { log.warn('no clipping container found'); bound.video = null; return false; }

    if (bound.video !== video || bound.container !== container) {
      bound.video = video;
      bound.container = container;
      if (ro) ro.disconnect();
      ro = new ResizeObserver(() => apply());
      ro.observe(container);
      ro.observe(video);
      log.debug('bound', { container: container.tagName + (container.id ? '#' + container.id : '') });
    }
    return true;
  }

  /** Recompute and apply. Cheap enough to call from any observer. */
  function apply() {
    if (!settings.enabled) { setScale(1); lastSolution = null; return; }
    if (!rebind()) { setScale(1); return; }
    const v = bound.video;
    const r = bound.container.getBoundingClientRect();
    if (!r.width || !r.height || !v.offsetWidth) return;

    const solution = PF.geometry.solve({
      containerW: r.width,
      containerH: r.height,
      boxW: v.offsetWidth,
      boxH: v.offsetHeight,
      frameAR: v.videoWidth / v.videoHeight,
      pictureAR: settings.pictureAR,
    });
    lastSolution = solution;
    setScale(PF.geometry.isWorthApplying(solution) ? solution.scale : 1);
  }

  const applySoon = () => setTimeout(apply, SETTLE_MS);

  function start(adapter, initial) {
    bound.adapter = adapter;
    settings = { ...settings, ...initial };
    ensureStyle(adapter);

    document.addEventListener('fullscreenchange', applySoon);
    window.addEventListener('resize', apply);
    // A new video element appears on SPA navigation and on quality/track switches.
    document.addEventListener('loadedmetadata', apply, true);
    document.addEventListener('resize', apply, true);       // <video> fires this on frame-size change
    document.addEventListener('playing', apply, true);
    if (adapter.observeExtra) cleanupExtra = adapter.observeExtra(apply) || null;

    // Watchdog: players swap elements without any event we can rely on.
    setInterval(apply, 2000);
    apply();
    log.info('active on', adapter.label);
  }

  function update(patch) {
    settings = { ...settings, ...patch };
    apply();
    return status();
  }

  function status() {
    const v = bound.video;
    return {
      adapter: bound.adapter ? { id: bound.adapter.id, label: bound.adapter.label, drm: !!bound.adapter.drm } : null,
      bound: Boolean(v),
      frame: v ? { w: v.videoWidth, h: v.videoHeight, ar: v.videoWidth / v.videoHeight } : null,
      settings,
      solution: lastSolution,
      canDetect: v ? PF.detect.canRead(v) : false,
    };
  }

  PF.engine = { start, update, status, apply, get video() { return bound.video; } };
})(globalThis.PF = globalThis.PF || {});
