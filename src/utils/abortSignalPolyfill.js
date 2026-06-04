/**
 * React Native may expose AbortSignal without the static abort() helper that
 * RTK Query / fetch use when cancelling in-flight requests. Polyfill early at app boot.
 */
const globalRef = typeof globalThis !== 'undefined' ? globalThis : global;

if (globalRef?.AbortSignal && typeof globalRef.AbortSignal.abort !== 'function') {
  globalRef.AbortSignal.abort = (reason) => {
    const controller = new AbortController();
    controller.abort(reason);
    return controller.signal;
  };
}

export function isAbortSignalCompatError(error) {
  const msg = String(error?.message ?? '');
  return (
    msg.includes('AbortSignal.abort') ||
    msg.includes('AbortSignal') ||
    (error?.name === 'TypeError' && msg.toLowerCase().includes('abort'))
  );
}
