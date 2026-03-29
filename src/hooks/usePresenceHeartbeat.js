import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePresencePingMutation } from '../store/api';
import { useAppSelector } from '../store/hooks';

const INTERVAL_MS = 45000;

/**
 * While logged in, periodically POST /presence/ping so the server knows this token/session is active.
 * Other users see you as "online" via GET /presence/online (not the attendees `status` field).
 */
export function usePresenceHeartbeat() {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const { selectedEventId } = useAppSelector((s) => s.event);
  const [ping] = usePresencePingMutation();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated || !user) return undefined;

    const resolveEventId = () => {
      const raw = selectedEventId ?? user?.event_id ?? user?.events?.[0]?.id;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const send = () => {
      ping({ event_id: resolveEventId() }).catch(() => {});
    };

    send();
    const interval = setInterval(send, INTERVAL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        send();
      }
      appStateRef.current = next;
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated, user, selectedEventId, ping]);
}
