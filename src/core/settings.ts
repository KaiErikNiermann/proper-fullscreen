/* eslint-disable security/detect-object-injection --
   `siteId` is never user input: it is an adapter id from our own closed registry
   (see src/adapters/registry.ts). These are plain map lookups on a settings object. */
/** Storage access, shared by content script and popup. */
import { DEFAULT_AR } from './presets.ts';
import type { SiteSettings } from './types.ts';

const KEY = 'sites';

export const defaults = (): SiteSettings => ({
  enabled: true,
  pictureAR: DEFAULT_AR,
  source: 'preset:scope239',
});

type SiteMap = Readonly<Record<string, Partial<SiteSettings>>>;

async function readAll(): Promise<SiteMap> {
  const stored = await browser.storage.local.get(KEY);
  return (stored[KEY] as SiteMap | undefined) ?? {};
}

export async function get(siteId: string): Promise<SiteSettings> {
  const all = await readAll();
  return { ...defaults(), ...all[siteId] };
}

export async function set(siteId: string, patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const all = await readAll();
  const next: SiteSettings = { ...defaults(), ...all[siteId], ...patch };
  await browser.storage.local.set({ [KEY]: { ...all, [siteId]: next } });
  return next;
}

export function onChange(cb: (siteId: string, s: SiteSettings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[KEY];
    if (!change) return;
    const next = (change.newValue as SiteMap | undefined) ?? {};
    for (const [siteId, s] of Object.entries(next)) cb(siteId, { ...defaults(), ...s });
  });
}
