/* Entry point for the content script. */
import './adapters/youtube.ts';
import './adapters/disneyplus.ts';
import './adapters/netflix.ts';
import './adapters/primevideo.ts';

import { forHost } from './adapters/registry.ts';
import { detect } from './core/detect.ts';
import * as engine from './core/engine.ts';
import { makeLogger } from './core/logger.ts';
import { nearest } from './core/presets.ts';
import * as settings from './core/settings.ts';

const log = makeLogger('content');

async function main(): Promise<void> {
  const adapter = forHost();
  if (!adapter) { log.debug('no adapter for', location.hostname); return; }

  engine.start(adapter, await settings.get(adapter.id));

  // The popup writes settings; storage is the source of truth, so it needs no tab messaging for
  // a change to take effect. Messaging is used only to read live status and to run detection.
  settings.onChange((siteId, next) => {
    if (siteId === adapter.id) engine.update(next);
  });

  browser.runtime.onMessage.addListener((raw: unknown): Promise<unknown> | undefined => {
    // Read the tag as a plain string: narrowing `Message` here would make the second comparison
    // statically "always true" without making it any safer at runtime.
    const type = (raw as { type?: string } | null)?.type;

    if (type === 'pf:status') return Promise.resolve(engine.status());

    if (type === 'pf:detect') {
      return (async () => {
        const v = engine.currentVideo();
        if (!v) return { ok: false as const, reason: 'no video bound' };
        const d = await detect(v);
        return d.ok ? { ...d, nearest: nearest(d.pictureAR) } : d;
      })();
    }

    // The WebExtension contract: undefined means "not handled by this listener".
    return undefined;
  });
}

main().catch((error: unknown) => { log.error('init failed', error); });
