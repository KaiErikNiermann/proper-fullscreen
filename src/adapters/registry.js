/*
 * Site adapters. An adapter only has to answer three questions: which <video>, which ancestor
 * clips it, and what selector the injected stylesheet should target. Everything else — the maths,
 * the observers, the lifecycle — is shared.
 */
(function (PF) {
  'use strict';
  const log = PF.log.make('adapter');

  /**
   * @typedef {Object} Adapter
   * @property {string} id
   * @property {string} label
   * @property {(host: string) => boolean} matches
   * @property {string} cssSelector          selector used inside the injected stylesheet
   * @property {() => HTMLVideoElement|null} [findVideo]
   * @property {(v: HTMLVideoElement) => Element|null} [findContainer]
   * @property {(apply: () => void) => (() => void)|void} [observeExtra]
   * @property {boolean} [drm]               readback known to be blocked
   */

  /**
   * Pick the playing video. Players commonly keep a hidden decoy <video> in the DOM (Disney+ has
   * exactly one), so never trust `querySelector('video')` — require a decoded frame.
   * @param {string} selector
   * @returns {HTMLVideoElement|null}
   */
  function pickVideo(selector) {
    /** @type {HTMLVideoElement[]} */
    const all = Array.from(document.querySelectorAll(selector));
    return all.find((v) => v.videoWidth > 0 && v.videoHeight > 0)
        ?? all.find((v) => getComputedStyle(v).display !== 'none')
        ?? null;
  }

  /**
   * Nearest ancestor that actually clips. Both verified players already provide one
   * (`#movie_player`, `.btm-media-client`), so we never inject a wrapper of our own — doing that
   * breaks player layout and their fullscreen element.
   * @param {HTMLVideoElement} v
   * @returns {Element|null}
   */
  function findClippingAncestor(v) {
    let el = v.parentElement;
    for (let i = 0; i < 10 && el; i++) {
      const cs = getComputedStyle(el);
      const clips = cs.overflow === 'hidden' || cs.overflow === 'clip'
        || cs.overflowX === 'hidden' || cs.overflowY === 'hidden';
      const r = el.getBoundingClientRect();
      // A scroll container is not a clipper. Prime Video's only overflow:hidden ancestor is
      // <body> at 4264px tall; trusting it yields a 1.61x scale that paints over the page.
      const isScrollHost = r.height > window.innerHeight * 1.5 || el === document.body
        || el === document.documentElement;
      if (clips && !isScrollHost && r.width >= v.offsetWidth - 1 && r.height > 0) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** @type {Adapter[]} */
  const ADAPTERS = [];

  /** @param {Adapter} a */
  const register = (a) => { ADAPTERS.push(a); };

  /** @returns {Adapter|null} */
  function forHost(host = location.hostname) {
    const a = ADAPTERS.find((x) => x.matches(host)) ?? null;
    if (a) log.debug('matched adapter', a.id);
    return a;
  }

  PF.adapters = { register, forHost, pickVideo, findClippingAncestor, ADAPTERS };
})(globalThis.PF = globalThis.PF || {});
