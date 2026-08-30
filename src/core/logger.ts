/**
 * Minimal namespaced logger. Verbose output is opt-in.
 */
const state = { isEnabled: false };

export const setDebug = (isEnabled: boolean): void => { state.isEnabled = isEnabled; };

export interface Logger {
  debug: (...a: readonly unknown[]) => void;
  info: (...a: readonly unknown[]) => void;
  warn: (...a: readonly unknown[]) => void;
  error: (...a: readonly unknown[]) => void;
}

export function makeLogger(scope: string): Logger {
  const tag = `[proper-fullscreen:${scope}]`;
  return {
    debug: (...a) => { if (state.isEnabled) console.debug(tag, ...a); },
    info: (...a) => { console.info(tag, ...a); },
    warn: (...a) => { console.warn(tag, ...a); },
    error: (...a) => { console.error(tag, ...a); },
  };
}
