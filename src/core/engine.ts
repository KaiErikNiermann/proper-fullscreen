/*
 * Lifecycle: bind to a player, inject the stylesheet, keep the scale correct across every layout
 * change. All site-specific knowledge lives in adapters; all maths lives in geometry.
 */
import { findClippingAncestor } from '../adapters/registry.ts';
import { canRead } from './detect.ts';
import { classifyTransform, isWorthApplying, solve } from './geometry.ts';
import { makeLogger } from './logger.ts';
import { defaults } from './settings.ts';
import type { Adapter, SiteSettings, Solution, Status } from './types.ts';

const log = makeLogger('engine');
const STYLE_ID = 'proper-fullscreen-style';
const SCALE_VAR = '--pf-scale';
const BASE_VAR = '--pf-base';
const SETTLE_MS = 350;    // fullscreen reports a transitional box before the window settles
const WATCHDOG_MS = 2000; // players swap elements with no event we can rely on

/*
 * One player per page, so the engine is a module-scoped singleton.
 */
interface EngineState {
  adapter: Adapter | null;
  video: HTMLVideoElement | null;
  container: Element | null;
  settings: SiteSettings;
  observer: ResizeObserver | null;
  lastSolution: Solution | null;
  baseTransform: string;
}

const state: EngineState = {
  adapter: null,
  video: null,
  container: null,
  settings: defaults(),
  observer: null,
  lastSolution: null,
  baseTransform: '',
};

/**
 * Injected once and left alone. Never write the video's inline `style`: every player tested owns
 * that attribute and rewrites it (YouTube on every resize, Netflix with a px height, Disney+ on
 * mount). A rule in <head> is outside their diff and survives re-renders.
 *
 * The player's own transform is composed in via --pf-base, never replaced.
 */
function ensureStyle(a: Adapter): void {
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    // Safe because the content script runs at document_idle, so <head> has been parsed.
    document.head.append(element);
  }
  const extraClip = a.needsClip ? `${a.needsClip} { overflow: hidden !important; }\n` : '';
  const css = `${extraClip}${a.cssSelector} {
  transform: var(${BASE_VAR}, ) scale(var(${SCALE_VAR}, 1)) !important;
  transform-origin: 50% 50% !important;
}`;
  if (element.textContent !== css) element.textContent = css;
}

/**
 * Read the transform the PLAYER applies, with our own rule momentarily disabled. Disabling and
 * restoring happen inside one synchronous task, so no frame is painted in between.
 */
function readNativeTransform(v: HTMLVideoElement): string {
  const element = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  const sheet = element?.sheet ?? null;
  const isPrevious = sheet?.disabled ?? false;
  if (sheet) sheet.disabled = true;
  const t = getComputedStyle(v).transform;
  if (sheet) sheet.disabled = isPrevious;
  return t;
}

const setScale = (s: number): void => {
  document.documentElement.style.setProperty(SCALE_VAR, s.toFixed(5));
};

/**
 * Resolve video + container for the current page.
 */
function rebind(): void {
  if (!state.adapter) return;
  const v = state.adapter.findVideo();
  if (!v?.videoWidth) { state.video = null; return; }
  const c = state.adapter.findContainer(v) ?? findClippingAncestor(v);
  if (!c) { log.warn('no clipping container found'); state.video = null; return; }

  if (state.video === v && state.container === c) {
    return;
  }

  state.video = v;
  state.container = c;
  state.observer?.disconnect();
  state.observer = new ResizeObserver(() => { apply(); });
  state.observer.observe(c);
  state.observer.observe(v);
  log.debug('bound', c.tagName + (c.id ? `#${c.id}` : ''));
}

/**
 * Recompute and apply. Cheap enough to call from any observer.
 */
export function apply(): void {
  if (!state.settings.enabled) { setScale(1); state.lastSolution = null; return; }
  rebind();
  if (!state.video || !state.container) { setScale(1); return; }

  const r = state.container.getBoundingClientRect();
  if (!r.width || !r.height || !state.video.offsetWidth) return;

  const base = classifyTransform(readNativeTransform(state.video), state.video.offsetWidth, state.video.offsetHeight);
  if (!base.ok) {
    log.warn('player uses an unsupported transform, refusing to zoom:', base.reason);
    setScale(1);
    state.lastSolution = null;
    return;
  }
  if (base.css !== state.baseTransform) {
    state.baseTransform = base.css;
    document.documentElement.style.setProperty(BASE_VAR, state.baseTransform);
  }

  state.lastSolution = solve({
    containerW: r.width,
    containerH: r.height,
    boxW: state.video.offsetWidth,
    boxH: state.video.offsetHeight,
    frameAR: state.video.videoWidth / state.video.videoHeight,
    pictureAR: state.settings.pictureAR,
  });
  setScale(isWorthApplying(state.lastSolution) ? state.lastSolution.scale : 1);
}

export function start(a: Adapter, initial: SiteSettings): void {
  state.adapter = a;
  state.settings = initial;
  ensureStyle(a);

  const applySoon = (): void => { setTimeout(apply, SETTLE_MS); };
  document.addEventListener('fullscreenchange', applySoon);
  // A new <video> element appears on SPA navigation and on quality/track switches.
  document.addEventListener('loadedmetadata', apply, { capture: true });
  // This is HTMLVideoElement's own `resize` event (the decoded frame changed size), not a
  // viewport resize — a ResizeObserver cannot report it.
  // eslint-disable-next-line unicorn/prefer-observer-apis -- media element event, not layout
  document.addEventListener('resize', apply, { capture: true });
  document.addEventListener('playing', apply, { capture: true });
  a.observeExtra?.(apply);

  setInterval(apply, WATCHDOG_MS);
  apply();
  log.info('active on', a.label);
}

export function update(patch: Partial<SiteSettings>): Status {
  state.settings = { ...state.settings, ...patch };
  apply();
  return status();
}

export function status(): Status {
  return {
    adapter: state.adapter
      ? { id: state.adapter.id, label: state.adapter.label, drm: state.adapter.drm }
      : null,
    bound: state.video !== null,
    frame: state.video ? { w: state.video.videoWidth, h: state.video.videoHeight, ar: state.video.videoWidth / state.video.videoHeight } : null,
    settings: state.settings,
    solution: state.lastSolution,
    baseTransform: state.baseTransform,
    canDetect: state.video ? canRead(state.video) : false,
  };
}

export const currentVideo = (): HTMLVideoElement | null => state.video;
