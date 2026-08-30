/*
 * Lifecycle: bind to a player, inject the stylesheet, keep the scale correct across every layout
 * change. All site-specific knowledge lives in adapters; all maths lives in geometry.
 */
import { findClippingAncestor } from '../adapters/registry.ts';
import { canRead } from './detect.ts';
import { classifyTransform, isWorthApplying, solve } from './geometry.ts';
import { makeLogger } from './logger.ts';
import type { Adapter, SiteSettings, Solution, Status } from './types.ts';

const log = makeLogger('engine');
const STYLE_ID = 'proper-fullscreen-style';
const SCALE_VAR = '--pf-scale';
const BASE_VAR = '--pf-base';
const SETTLE_MS = 350;    // fullscreen reports a transitional box before the window settles
const WATCHDOG_MS = 2000; // players swap elements with no event we can rely on

let adapter: Adapter | null = null;
let video: HTMLVideoElement | null = null;
let container: Element | null = null;
let settings: SiteSettings;
let observer: ResizeObserver | null = null;
let lastSolution: Solution | null = null;
let baseTransform = '';

/**
 * Injected once and left alone. Never write the video's inline `style`: every player tested owns
 * that attribute and rewrites it (YouTube on every resize, Netflix with a px height, Disney+ on
 * mount). A rule in <head> is outside their diff and survives re-renders.
 *
 * The player's own transform is composed in via --pf-base, never replaced.
 */
function ensureStyle(a: Adapter): void {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    // Safe because the content script runs at document_idle, so <head> has been parsed.
    document.head.append(el);
  }
  const extraClip = a.needsClip ? `${a.needsClip} { overflow: hidden !important; }\n` : '';
  const css = `${extraClip}${a.cssSelector} {
  transform: var(${BASE_VAR}, ) scale(var(${SCALE_VAR}, 1)) !important;
  transform-origin: 50% 50% !important;
}`;
  if (el.textContent !== css) el.textContent = css;
}

/**
 * Read the transform the PLAYER applies, with our own rule momentarily disabled. Disabling and
 * restoring happen inside one synchronous task, so no frame is painted in between.
 */
function readNativeTransform(v: HTMLVideoElement): string {
  const el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  const sheet = el?.sheet ?? null;
  const prev = sheet?.disabled ?? false;
  if (sheet) sheet.disabled = true;
  const t = getComputedStyle(v).transform;
  if (sheet) sheet.disabled = prev;
  return t;
}

const setScale = (s: number): void => {
  document.documentElement.style.setProperty(SCALE_VAR, s.toFixed(5));
};

/** Resolve video + container for the current page. */
function rebind(): boolean {
  if (!adapter) return false;
  const v = adapter.findVideo();
  if (!v?.videoWidth) { video = null; return false; }
  const c = adapter.findContainer(v) ?? findClippingAncestor(v);
  if (!c) { log.warn('no clipping container found'); video = null; return false; }

  if (video !== v || container !== c) {
    video = v;
    container = c;
    observer?.disconnect();
    observer = new ResizeObserver(() => { apply(); });
    observer.observe(c);
    observer.observe(v);
    log.debug('bound', c.tagName + (c.id ? `#${c.id}` : ''));
  }
  return true;
}

/** Recompute and apply. Cheap enough to call from any observer. */
export function apply(): void {
  if (!settings.enabled) { setScale(1); lastSolution = null; return; }
  if (!rebind() || !video || !container) { setScale(1); return; }

  const r = container.getBoundingClientRect();
  if (!r.width || !r.height || !video.offsetWidth) return;

  const base = classifyTransform(readNativeTransform(video), video.offsetWidth, video.offsetHeight);
  if (!base.ok) {
    log.warn('player uses an unsupported transform, refusing to zoom:', base.reason);
    setScale(1);
    lastSolution = null;
    return;
  }
  if (base.css !== baseTransform) {
    baseTransform = base.css;
    document.documentElement.style.setProperty(BASE_VAR, baseTransform);
  }

  lastSolution = solve({
    containerW: r.width,
    containerH: r.height,
    boxW: video.offsetWidth,
    boxH: video.offsetHeight,
    frameAR: video.videoWidth / video.videoHeight,
    pictureAR: settings.pictureAR,
  });
  setScale(isWorthApplying(lastSolution) ? lastSolution.scale : 1);
}

export function start(a: Adapter, initial: SiteSettings): void {
  adapter = a;
  settings = initial;
  ensureStyle(a);

  const applySoon = (): void => { setTimeout(apply, SETTLE_MS); };
  document.addEventListener('fullscreenchange', applySoon);
  globalThis.addEventListener('resize', apply);
  // A new video element appears on SPA navigation and on quality/track switches.
  document.addEventListener('loadedmetadata', apply, true);
  document.addEventListener('resize', apply, true);   // <video> fires this on frame-size change
  document.addEventListener('playing', apply, true);
  a.observeExtra?.(apply);

  setInterval(apply, WATCHDOG_MS);
  apply();
  log.info('active on', a.label);
}

export function update(patch: Partial<SiteSettings>): Status {
  settings = { ...settings, ...patch };
  apply();
  return status();
}

export function status(): Status {
  return {
    adapter: adapter ? { id: adapter.id, label: adapter.label, drm: adapter.drm } : null,
    bound: video !== null,
    frame: video ? { w: video.videoWidth, h: video.videoHeight, ar: video.videoWidth / video.videoHeight } : null,
    settings,
    solution: lastSolution,
    baseTransform,
    canDetect: video ? canRead(video) : false,
  };
}

export const currentVideo = (): HTMLVideoElement | null => video;
