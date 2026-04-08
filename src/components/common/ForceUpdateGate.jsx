import * as Application from 'expo-application';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { colors, radius } from '../../constants/theme';
import { isVersionBelow } from '../../utils/compareVersions';

/**
 * Prefer native versionName / CFBundleShortVersionString (matches Play Store / Settings).
 * expoConfig.version can drift from OTA or be missing in some release builds.
 */
function getInstalledAppVersion() {
  const native = Application.nativeApplicationVersion;
  if (native != null && String(native).trim() !== '') {
    return String(native).trim();
  }
  return (
    Constants.expoConfig?.version ||
    (typeof Constants.manifest === 'object' && Constants.manifest?.version) ||
    '0.0.0'
  );
}

function isForceUpdateEnabled(data) {
  const v = data?.force_update;
  return v === true || v === 1 || String(v).toLowerCase() === 'true';
}

/**
 * Fetches /mobile/app-version (no auth). If force_update and installed version < minimum,
 * shows a blocking modal until the user opens the store (cannot dismiss).
 */
export function ForceUpdateGate({ children }) {
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const cancelledRef = useRef(false);
  const blockedRef = useRef(false);
  blockedRef.current = blocked;

  const runVersionCheck = useCallback(async () => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      if (__DEV__) {
        console.warn(
          '[ForceUpdateGate] Skipped: running in Expo Go (appOwnership=expo). Use a release/dev build to test force update.'
        );
      }
      return;
    }

    try {
      const url = `${API_BASE_URL.replace(/\/?$/, '/')}${API_ENDPOINTS.APP_VERSION}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        if (__DEV__) {
          console.warn('[ForceUpdateGate] Invalid JSON from app-version');
        }
      }
      if (cancelledRef.current) return;

      if (!res.ok && __DEV__) {
        console.warn('[ForceUpdateGate] app-version HTTP', res.status);
      }

      if (!data?.success || !isForceUpdateEnabled(data)) {
        return;
      }

      const installed = getInstalledAppVersion();
      const min =
        Platform.OS === 'ios' ? data.min_version_ios : data.min_version_android;
      const minStr = min && String(min).trim() ? String(min).trim() : '0.0.0';

      if (__DEV__) {
        console.log('[ForceUpdateGate]', {
          installed,
          minPlatform: minStr,
          shouldBlock: isVersionBelow(installed, minStr),
          url,
        });
      }

      if (!isVersionBelow(installed, minStr)) {
        return;
      }

      const link =
        Platform.OS === 'ios'
          ? data.store_url_ios || data.store_url_android
          : data.store_url_android || data.store_url_ios;

      setMessage(
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'Please update the app to continue.'
      );
      setStoreUrl(typeof link === 'string' ? link.trim() : '');
      setBlocked(true);
    } catch (e) {
      if (__DEV__) {
        console.warn('[ForceUpdateGate] app-version fetch failed', e?.message ?? e);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    runVersionCheck();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !blockedRef.current) {
        runVersionCheck();
      }
    });

    return () => {
      cancelledRef.current = true;
      sub.remove();
    };
  }, [runVersionCheck]);

  useEffect(() => {
    if (!blocked) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked]);

  const openStore = async () => {
    const fallbackPlay = 'market://details?id=com.precisionglobe.app';
    const fallbackWeb =
      'https://play.google.com/store/apps/details?id=com.precisionglobe.app';
    const url = storeUrl || (Platform.OS === 'android' ? fallbackPlay : '');

    if (!url) {
      await Linking.openURL(fallbackWeb);
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(fallbackPlay);
      } catch {
        await Linking.openURL(fallbackWeb);
      }
    }
  };

  return (
    <>
      {children}
      <Modal visible={blocked} animationType="fade" transparent={false} onRequestClose={() => {}}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.card}>
            <Text style={styles.title}>Update required</Text>
            <Text style={styles.body}>{message}</Text>
            <Text style={styles.hint}>
              Current version: {getInstalledAppVersion()}
            </Text>
            <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Update & continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
