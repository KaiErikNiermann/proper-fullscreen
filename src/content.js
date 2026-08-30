/* Entry point. Loaded last — every PF.* namespace is populated by the files before it. */
(function (PF) {
  'use strict';
  const log = PF.log.make('content');

  async function main() {
    const adapter = PF.adapters.forHost();
    if (!adapter) { log.debug('no adapter for', location.hostname); return; }

    const s = await PF.settings.get(adapter.id);
    PF.engine.start(adapter, s);

    // Popup writes settings; storage is the source of truth so the popup needs no tab messaging
    // to take effect. Messaging is used only to read live status back.
    PF.settings.onChange((siteId, next) => {
      if (siteId === adapter.id) PF.engine.update(next);
    });

    PF.settings.api.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg.type !== 'string') return undefined;
      switch (msg.type) {
        case 'pf:status':
          return Promise.resolve(PF.engine.status());
        case 'pf:detect':
          return (async () => {
            const v = PF.engine.video;
            if (!v) return { ok: false, reason: 'no video bound' };
            const d = await PF.detect.detect(v);
            if (d.ok) {
              const near = PF.presets.nearest(d.pictureAR);
              return { ...d, nearest: { id: near.id, label: near.label, ar: near.ar } };
            }
            return d;
          })();
        default:
          return undefined;
      }
    });
  }

  main().catch((e) => log.error('init failed', e));
})(globalThis.PF = globalThis.PF || {});
