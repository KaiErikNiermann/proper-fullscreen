/* Storage access, shared by content script and popup. Plain script, loadable in both. */
(function (PF) {
  'use strict';
  const api = globalThis.browser ?? globalThis.chrome;
  const KEY = 'sites';

  /**
   * @typedef {Object} SiteSettings
   * @property {boolean} enabled
   * @property {number} pictureAR
   * @property {string} source   'preset:<id>' | 'custom' | 'auto'
   */

  /** @returns {SiteSettings} */
  const defaults = () => ({ enabled: true, pictureAR: PF.presets.DEFAULT_AR, source: 'preset:scope239' });

  /** @param {string} siteId @returns {Promise<SiteSettings>} */
  async function get(siteId) {
    const all = (await api.storage.local.get(KEY))[KEY] ?? {};
    return { ...defaults(), ...(all[siteId] ?? {}) };
  }

  /** @param {string} siteId @param {Partial<SiteSettings>} patch */
  async function set(siteId, patch) {
    const all = (await api.storage.local.get(KEY))[KEY] ?? {};
    const next = { ...defaults(), ...(all[siteId] ?? {}), ...patch };
    all[siteId] = next;
    await api.storage.local.set({ [KEY]: all });
    return next;
  }

  /** @param {(siteId: string, s: SiteSettings) => void} cb */
  function onChange(cb) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      const next = changes[KEY].newValue ?? {};
      for (const [siteId, s] of Object.entries(next)) cb(siteId, s);
    });
  }

  PF.settings = { get, set, onChange, defaults, api };
})(globalThis.PF = globalThis.PF || {});
