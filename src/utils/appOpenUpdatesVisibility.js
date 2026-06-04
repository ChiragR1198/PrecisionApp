import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_OPEN_UPDATES_INTERVAL_MS = 24 * 60 * 60 * 1000;

function storageKey(userId) {
  const id = userId != null && userId !== '' ? String(userId) : 'default';
  return `app_open_updates_dismissed_at_${id}`;
}

/** True if the "Updates for you" banner may be shown (24h since last dismiss). */
export async function shouldShowAppOpenUpdates(userId) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return true;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return true;
    return Date.now() - dismissedAt >= APP_OPEN_UPDATES_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function recordAppOpenUpdatesDismissed(userId) {
  try {
    await AsyncStorage.setItem(storageKey(userId), String(Date.now()));
  } catch (e) {
    console.warn('recordAppOpenUpdatesDismissed failed', e);
  }
}
