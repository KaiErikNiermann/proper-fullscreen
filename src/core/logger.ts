/** Minimal namespaced logger. Verbose output is opt-in. */
let enabled = false;

export const setDebug = (v: boolean): void => { enabled = v; };

export interface Logger {
  debug: (...a: readonly unknown[]) => void;
  info: (...a: readonly unknown[]) => void;
  warn: (...a: readonly unknown[]) => void;
  error: (...a: readonly unknown[]) => void;
}

export function makeLogger(scope: string): Logger {
  const tag = `[proper-fullscreen:${scope}]`;
  return {
    debug: (...a) => { if (enabled) console.debug(tag, ...a); },
    info: (...a) => { console.info(tag, ...a); },
    warn: (...a) => { console.warn(tag, ...a); },
    error: (...a) => { console.error(tag, ...a); },
  };
}
