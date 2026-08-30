/*
 * Popup UI. Settings are written to storage (the content script watches it); messaging is used
 * only to read live status and to run detection.
 */
import { nearest, parseAR, PRESETS } from '../core/presets.ts';
import * as settings from '../core/settings.ts';
import type { Detection, Preset, SiteSettings, Status } from '../core/types.ts';

function need<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`popup: missing #${id}`);
  return element as T;
}

const els = {
  site: need<HTMLSpanElement>('site'),
  badge: need<HTMLSpanElement>('badge'),
  stat: need<HTMLSpanElement>('stat'),
  enabled: need<HTMLInputElement>('enabled'),
  presets: need<HTMLFieldSetElement>('presets'),
  customAR: need<HTMLInputElement>('customAR'),
  applyCustom: need<HTMLButtonElement>('applyCustom'),
  detect: need<HTMLButtonElement>('detect'),
  msg: need<HTMLDivElement>('msg'),
};

/*
 * Single-document script, so its two pieces of mutable state live together.
 */
const state: { siteId: string | null; tabId: number | null } = { siteId: null, tabId: null };

const say = (text: string, cls = ''): void => {
  els.msg.textContent = text;
  els.msg.className = `msg ${cls}`;
};

async function save(patch: Partial<SiteSettings>): Promise<void> {
  if (state.siteId === null) return;
  await settings.set(state.siteId, patch);
  say('Applied.', 'ok');
  setTimeout(() => { void refreshStatus(); }, 250);
}

function presetRow(p: Preset, current: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'opt';

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'ar';
  input.checked = current === `preset:${p.id}`;
  input.addEventListener('change', () => {
    void save({ pictureAR: p.ar, source: `preset:${p.id}` });
  });

  const name = document.createElement('span');
  name.className = 'opt-label';
  name.textContent = p.label;

  const note = document.createElement('span');
  note.className = 'opt-note';
  note.textContent = p.note;

  label.append(input, name, note);
  return label;
}

function renderStat(status: Status): void {
  const f = status.frame;
  if (!f) { els.stat.textContent = 'no video bound'; return; }
  const sol = status.solution;
  const scaleText = sol ? sol.scale.toFixed(4) : '—';
  const boundText = sol && sol.boundBy !== 'none' ? `  ·  ${sol.boundBy}-bound` : '  ·  no zoom';
  els.stat.textContent = `frame ${f.w}×${f.h} (${f.ar.toFixed(3)})  ·  scale ${scaleText}${boundText}`;
}

async function refreshStatus(): Promise<void> {
  if (state.tabId === null) return;
  let status: Status | undefined;
  try {
    status = await browser.tabs.sendMessage(state.tabId, { type: 'pf:status' }) as Status | undefined;
  } catch {
    els.stat.textContent = 'Content script not loaded — reload the page.';
    return;
  }
  if (!status?.adapter) { els.stat.textContent = 'No supported player here.'; return; }

  state.siteId = status.adapter.id;
  els.site.textContent = status.adapter.label;
  els.badge.textContent = status.adapter.drm ? 'DRM' : 'readable';
  els.badge.className = status.adapter.drm ? 'badge drm' : 'badge';
  els.detect.disabled = !status.canDetect;
  els.detect.title = status.canDetect ? '' : 'Pixel readback is blocked on this player (DRM).';
  els.enabled.checked = status.settings.enabled;

  renderStat(status);
  els.presets.replaceChildren(...PRESETS.map((p) => presetRow(p, status.settings.source)));
  if (status.settings.source === 'custom') els.customAR.value = status.settings.pictureAR.toFixed(4);
}

els.enabled.addEventListener('change', () => { void save({ enabled: els.enabled.checked }); });

els.applyCustom.addEventListener('click', () => {
  const ar = parseAR(els.customAR.value);
  if (ar === null) { say('Enter a number (2.39) or a ratio (21:9).', 'warn'); return; }
  void save({ pictureAR: ar, source: 'custom' });
});
els.customAR.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.applyCustom.click();
});

els.detect.addEventListener('click', () => {
  void (async () => {
    if (state.tabId === null) return;
    say('Sampling frames…');
    els.detect.disabled = true;
    try {
      const d = await browser.tabs.sendMessage(state.tabId, { type: 'pf:detect' }) as Detection | undefined;
      if (!d?.ok) { say(d?.reason ?? 'Detection failed.', 'warn'); return; }
      const near = nearest(d.pictureAR);
      await save({ pictureAR: near.ar, source: `preset:${near.id}` });
      say(`Measured ${d.pictureAR.toFixed(4)} over ${d.samples} frames → snapped to ${near.label}.`, 'ok');
    } catch (error) {
      say(`Detection failed: ${String(error)}`, 'warn');
    } finally {
      els.detect.disabled = false;
    }
  })();
});

void (async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  await refreshStatus();
})();
