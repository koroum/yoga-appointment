const isDev = import.meta.env.DEV

/* eslint-disable no-console */
export const logger = {
  debug: isDev
    ? (...args: unknown[]) => console.debug('[debug]', ...args)
    : () => {},
  info: isDev
    ? (...args: unknown[]) => console.info('[info]', ...args)
    : () => {},
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
}
