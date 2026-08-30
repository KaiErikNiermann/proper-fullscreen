/* Minimal namespaced logger. Verbose output is opt-in via storage key `debug`. */
(function (PF) {
  'use strict';
  let enabled = false;

  /** @param {boolean} v */
  const setDebug = (v) => { enabled = Boolean(v); };

  const make = (scope) => ({
    debug: (...a) => { if (enabled) console.debug(`[proper-fullscreen:${scope}]`, ...a); },
    info: (...a) => console.info(`[proper-fullscreen:${scope}]`, ...a),
    warn: (...a) => console.warn(`[proper-fullscreen:${scope}]`, ...a),
    error: (...a) => console.error(`[proper-fullscreen:${scope}]`, ...a),
  });

  PF.log = { make, setDebug };
})(globalThis.PF = globalThis.PF || {});
