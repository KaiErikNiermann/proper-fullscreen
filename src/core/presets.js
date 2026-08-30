/*
 * Aspect-ratio presets. Shared verbatim by the content script and the popup, so this file must
 * stay dependency-free and loadable as a plain (non-module) script in both contexts.
 */
(function (PF) {
  'use strict';

  /**
   * @typedef {Object} Preset
   * @property {string} id
   * @property {string} label
   * @property {number} ar
   * @property {string} note
   */

  /** @type {readonly Preset[]} */
  const PRESETS = Object.freeze([
    { id: 'scope239',  label: 'Scope 2.39:1',      ar: 2.39,   note: 'Standard anamorphic cinema — the usual answer' },
    { id: 'scope235',  label: 'Scope 2.35:1',      ar: 2.35,   note: 'Older anamorphic prints; within 1% of 2.39' },
    { id: 'uni2',      label: 'Univisium 2:1',     ar: 2.0,    note: 'Many Netflix originals and modern drama' },
    { id: 'ultra276',  label: 'Ultra Panavision',  ar: 2.76,   note: 'Rare — Hateful Eight, Ben-Hur' },
    { id: 'imax190',   label: 'IMAX Digital 1.90', ar: 1.9,    note: 'Endgame and most IMAX-mastered Marvel' },
    { id: 'flat185',   label: 'Flat 1.85:1',       ar: 1.85,   note: 'Standard non-anamorphic theatrical' },
    { id: 'wide169',   label: '16:9',              ar: 16 / 9, note: 'No-op — already fills the container' },
    { id: 'imax143',   label: 'IMAX 70mm 1.43',    ar: 1.43,   note: 'Taller than 16:9 — pillarboxed, not letterboxed' },
    { id: 'academy43', label: 'Academy 4:3',       ar: 4 / 3,  note: 'Pre-1953 and deliberate throwbacks' },
  ]);

  const DEFAULT_AR = 2.39;

  /**
   * Nearest preset to a measured ratio, compared in log space so the comparison is
   * scale-invariant: $d = |\ln(ar) - \ln(ar_i)|$.
   * @param {number} ar
   * @returns {Preset}
   */
  function nearest(ar) {
    let best = PRESETS[0];
    let bestD = Infinity;
    for (const p of PRESETS) {
      const d = Math.abs(Math.log(ar) - Math.log(p.ar));
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /** @param {unknown} v @returns {number|null} */
  function parseAR(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v : null;
    if (typeof v !== 'string') return null;
    const s = v.trim();
    const colon = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(s);
    if (colon) {
      const n = Number(colon[1]); const d = Number(colon[2]);
      return d > 0 && n > 0 ? n / d : null;
    }
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  PF.presets = { PRESETS, DEFAULT_AR, nearest, parseAR };
})(globalThis.PF = globalThis.PF || {});
