/*
 * Site adapters. An adapter only has to answer three questions: which <video>, which ancestor
 * clips it, and what selector the injected stylesheet should target. Everything else — the maths,
 * the observers, the lifecycle — is shared.
 */
import { makeLogger } from '../core/logger.ts';
import type { Adapter } from '../core/types.ts';

const log = makeLogger('adapter');

/**
 * Pick the playing video. Players commonly keep a hidden decoy <video> in the DOM (Disney+ has
 * one, Prime Video two), so never trust `querySelector('video')` — require a decoded frame.
 */
export function pickVideo(selector: string): HTMLVideoElement | null {
  const all = [...document.querySelectorAll<HTMLVideoElement>(selector)];
  return all.find((v) => v.videoWidth > 0 && v.videoHeight > 0)
    ?? all.find((v) => getComputedStyle(v).display !== 'none')
    ?? null;
}

/**
 * Nearest ancestor that actually clips. YouTube (`#movie_player`), Disney+ (`.btm-media-client`)
 * and Netflix all provide one, so we never inject a wrapper of our own — that breaks player
 * layout and their fullscreen element. Prime Video provides none and declares `needsClip`.
 */
export function findClippingAncestor(v: HTMLVideoElement): Element | null {
  let el = v.parentElement;
  for (let i = 0; i < 10 && el; i++) {
    const cs = getComputedStyle(el);
    const clips = cs.overflow === 'hidden' || cs.overflow === 'clip'
      || cs.overflowX === 'hidden' || cs.overflowY === 'hidden';
    const r = el.getBoundingClientRect();
    // A scroll container is not a clipper. Prime Video's only overflow:hidden ancestor is <body>
    // at 4264px tall; trusting it yields a 1.61x scale that paints over the page.
    const isScrollHost = r.height > globalThis.innerHeight * 1.5
      || el === document.body || el === document.documentElement;
    if (clips && !isScrollHost && r.width >= v.offsetWidth - 1 && r.height > 0) return el;
    el = el.parentElement;
  }
  return null;
}

const ADAPTERS: Adapter[] = [];

export const register = (a: Adapter): void => { ADAPTERS.push(a); };

export function forHost(host: string = location.hostname): Adapter | null {
  const a = ADAPTERS.find((x) => x.matches(host)) ?? null;
  if (a) log.debug('matched adapter', a.id);
  return a;
}
