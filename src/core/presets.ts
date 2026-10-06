/**
 * Aspect-ratio presets. Shared by the content script and the popup.
 */
import type { Preset } from './types.ts';

export const PRESETS: readonly Preset[] = Object.freeze([
  { id: 'scope239',  label: 'Scope 2.39:1',      ar: 2.39,   note: 'Standard anamorphic cinema — the usual answer' },
  { id: 'scope235',  label: 'Scope 2.35:1',      ar: 2.35,   note: 'Older anamorphic prints; within 1% of 2.39' },
  { id: 'uni2',      label: 'Univisium 2:1',     ar: 2,      note: 'Many Netflix originals and modern drama' },
  { id: 'ultra276',  label: 'Ultra Panavision',  ar: 2.76,   note: 'Rare — Hateful Eight, Ben-Hur' },
  { id: 'imax190',   label: 'IMAX Digital 1.90', ar: 1.9,    note: 'Endgame and most IMAX-mastered Marvel' },
  { id: 'flat185',   label: 'Flat 1.85:1',       ar: 1.85,   note: 'Standard non-anamorphic theatrical' },
  { id: 'wide169',   label: '16:9',              ar: 16 / 9, note: 'No-op — already fills the container' },
  { id: 'imax143',   label: 'IMAX 70mm 1.43',    ar: 1.43,   note: 'Taller than 16:9 — pillarboxed, not letterboxed' },
  { id: 'academy43', label: 'Academy 4:3',       ar: 4 / 3,  note: 'Pre-1953 and deliberate throwbacks' },
] as const satisfies readonly Preset[]);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PRESETS is a non-empty literal
export const DEFAULT_PRESET: Preset = PRESETS[0]!;
export const DEFAULT_AR = DEFAULT_PRESET.ar;

/**
 * Nearest preset to a measured ratio, compared in log space so the comparison is scale-invariant:
 * $d = |\ln(ar) - \ln(ar_i)|$.
 */
export function nearest(ar: number): Preset {
  let best = DEFAULT_PRESET;
  let bestD = Infinity;
  for (const p of PRESETS) {
    const d = Math.abs(Math.log(ar) - Math.log(p.ar));
    // eslint-disable-next-line unicorn/prefer-continue -- `d < bestD` is false for NaN; `>=` would not be
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Parse `2.39`, `21:9` or `21/9`. Returns null for anything non-positive or unparseable.
 */
export function parseAR(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const s = v.trim();
  // Split rather than match: a nested-quantifier regex here trips the ReDoS detector for no gain.
  const parts = s.split(/[:/]/);
  if (parts.length === 2) {
    const n = Number(parts[0]?.trim());
    const d = Number(parts[1]?.trim());
    return Number.isFinite(n) && Number.isFinite(d) && n > 0 && d > 0 ? n / d : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
