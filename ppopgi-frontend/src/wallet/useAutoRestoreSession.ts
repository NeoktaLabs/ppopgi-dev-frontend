// src/wallet/useAutoRestoreSession.ts
/**
 * thirdweb handles session restore internally.
 *
 * We keep this hook as a no-op so existing imports and calls
 * (e.g. in App.tsx) don't break while we migrate.
 */
export function useAutoRestoreSession() {
  return;
}