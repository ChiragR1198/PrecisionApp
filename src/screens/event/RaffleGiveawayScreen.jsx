import Icon from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, CameraView } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactSavedSuccessModal } from '../../components/common/ContactSavedSuccessModal';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { useBoothRaffleBoothDetailsMutation, useBoothRaffleSubmitMutation } from '../../store/api';
import { normalizeEventIdForApi } from '../../utils/parseEventId';

const storageKeyForEvent = (eventId) => `raffle_giveaway_entries_${eventId}`;

function normalizeScannedQrPayload(raw) {
  let s = String(raw ?? '');
  s = s.replace(/^\uFEFF/, '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s.trim();
}

function pickQrScanPayload(scanningResult) {
  if (!scanningResult || typeof scanningResult !== 'object') return '';
  const data = String(scanningResult.data ?? '');
  const raw = String(scanningResult.raw ?? '');
  if (!raw) return data;
  if (!data) return raw;
  if (raw.length > data.length) return raw;
  if (raw.length === data.length && /BEGIN:VCARD/i.test(raw)) return raw;
  return data;
}

function stripHtmlLite(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** @typedef {{ boothId: number, boothNo: string, title: string, companyName: string, eventTitle: string, enteredAt: number }} RaffleEntry */

export const RaffleGiveawayScreen = () => {
  const params = useLocalSearchParams();
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const eventIdRaw = params.eventId ?? params.event_id;
  const eventIdNum = normalizeEventIdForApi(eventIdRaw);

  const { SIZES } = useMemo(() => {
    const isAndroid = Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getResponsiveValue = ({ android, ios, tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      if (isAndroid && android !== undefined) return android;
      if (isIOS && ios !== undefined) return ios;
      return defaultValue;
    };
    return {
      SIZES: {
        headerIconSize: getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
      },
    };
  }, [SCREEN_WIDTH]);

  const [hasPermission, setHasPermission] = useState(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  /** 'scanner' | 'confirm' | 'hub' — hub = at least one saved entry exists (persisted) or after first successful Yes */
  const [screenMode, setScreenMode] = useState('scanner');
  const [entries, setEntries] = useState(/** @type {RaffleEntry[]} */ ([]));

  const [scanning, setScanning] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [booth, setBooth] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [raffleSuccessVisible, setRaffleSuccessVisible] = useState(false);
  const [raffleSuccessTitle, setRaffleSuccessTitle] = useState('');
  const [raffleSuccessMessage, setRaffleSuccessMessage] = useState('');

  const debounceRef = useRef(null);
  const bestPayloadRef = useRef(null);

  const [fetchBoothDetails] = useBoothRaffleBoothDetailsMutation();
  const [submitRaffle] = useBoothRaffleSubmitMutation();

  const persistEntriesToStorage = useCallback(
    async (next) => {
      if (eventIdNum == null) return;
      try {
        await AsyncStorage.setItem(storageKeyForEvent(eventIdNum), JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [eventIdNum]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (eventIdNum == null) {
        setStorageLoaded(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(storageKeyForEvent(eventIdNum));
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        if (cancelled) return;
        setEntries(list);
        if (list.length > 0) {
          setScreenMode('hub');
          setScanning(false);
        } else {
          setScreenMode('scanner');
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setScreenMode('scanner');
        }
      } finally {
        if (!cancelled) setStorageLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventIdNum]);

  const requestPermission = useCallback(async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const ok = status === 'granted';
    setHasPermission(ok);
    setScanning(ok);
    setBooth(null);
    setScanError(null);
  }, []);

  useEffect(() => {
    if (!storageLoaded || eventIdNum == null) return;
    if (screenMode === 'scanner') {
      requestPermission();
    }
  }, [storageLoaded, eventIdNum, screenMode, requestPermission]);

  const openScanner = useCallback(() => {
    setBooth(null);
    setScanError(null);
    setScreenMode('scanner');
    setScanning(true);
    bestPayloadRef.current = null;
    requestPermission();
  }, [requestPermission]);

  const resetScanOnly = useCallback(() => {
    setBooth(null);
    setScanError(null);
    setScanning(true);
    bestPayloadRef.current = null;
  }, []);

  const onBarcodeScanned = useCallback(
    (scanningResult) => {
      const picked = normalizeScannedQrPayload(pickQrScanPayload(scanningResult));
      if (!picked || eventIdNum == null) return;

      const prev = bestPayloadRef.current;
      if (!prev || picked.length >= prev.length) {
        bestPayloadRef.current = { payload: picked, scanningResult };
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        const pair = bestPayloadRef.current;
        bestPayloadRef.current = null;
        const final = pair?.payload ?? picked;
        if (!final) return;

        setScanning(false);
        setLoadingDetails(true);
        setScanError(null);

        try {
          const res = await fetchBoothDetails({
            event_id: eventIdNum,
            raw: final,
          }).unwrap();

          if (res?.success && res?.data?.booth) {
            setBooth(res.data.booth);
            setScreenMode('confirm');
          } else {
            setScanError(res?.message || 'Could not read this QR code.');
            setScanning(true);
          }
        } catch (e) {
          const msg = e?.data?.message || e?.error || 'Booth not found for this event.';
          setScanError(typeof msg === 'string' ? msg : 'Booth not found for this event.');
          setScanning(true);
        } finally {
          setLoadingDetails(false);
        }
      }, 400);
    },
    [eventIdNum, fetchBoothDetails]
  );

  const appendEntry = useCallback(
    (b) => {
      const row = {
        boothId: Number(b.id),
        boothNo: String(b.booth_no ?? ''),
        title: String(b.title ?? ''),
        companyName: String(b.company_name ?? ''),
        eventTitle: String(b.event_title ?? ''),
        enteredAt: Date.now(),
      };
      setEntries((prev) => {
        const without = prev.filter((e) => e.boothId !== row.boothId);
        const next = [row, ...without];
        persistEntriesToStorage(next);
        return next;
      });
    },
    [persistEntriesToStorage]
  );

  const onYes = useCallback(async () => {
    if (!booth?.id || eventIdNum == null) return;
    setSubmitting(true);
    try {
      const res = await submitRaffle({
        event_id: eventIdNum,
        booth_id: booth.id,
        opted_in: true,
      }).unwrap();

      if (res?.data?.already_entered) {
        appendEntry(booth);
        setBooth(null);
        setScreenMode('hub');
        setScanning(false);
        const label = [booth.title, booth.booth_no ? `Booth ${booth.booth_no}` : '']
          .filter(Boolean)
          .join(' — ');
        setRaffleSuccessTitle('Already entered');
        setRaffleSuccessMessage(
          res.message || `${label || 'This booth'} — you were already in the raffle.`
        );
        setRaffleSuccessVisible(true);
        return;
      }
      if (res?.success) {
        appendEntry(booth);
        setBooth(null);
        setScreenMode('hub');
        setScanning(false);
        const name = booth.title || booth.company_name || 'This booth';
        const bno = booth.booth_no ? `Booth ${booth.booth_no}` : '';
        setRaffleSuccessTitle('Entry saved');
        setRaffleSuccessMessage(
          res.message ||
            `${[name, bno].filter(Boolean).join(' — ')} — your entry has been saved.`
        );
        setRaffleSuccessVisible(true);
        return;
      }
    } catch (e) {
      const msg = e?.data?.message || e?.error || 'Could not save your entry.';
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Could not save your entry.');
    } finally {
      setSubmitting(false);
    }
  }, [booth, eventIdNum, submitRaffle, appendEntry]);

  const onNo = useCallback(() => {
    setBooth(null);
    setScanError(null);
    if (entries.length > 0) {
      setScreenMode('hub');
      setScanning(false);
    } else {
      setScreenMode('scanner');
      resetScanOnly();
    }
  }, [entries.length, resetScanOnly]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (eventIdNum == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <Header
          title="Raffle Giveaway"
          leftIcon="arrow-left"
          onLeftPress={() => router.back()}
          iconSize={SIZES.headerIconSize}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>Open this screen from My Event so the current event is selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!storageLoaded) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <Header
          title="Raffle Giveaway"
          leftIcon="arrow-left"
          onLeftPress={() => router.back()}
          iconSize={SIZES.headerIconSize}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const showHubChrome = entries.length > 0 && screenMode !== 'scanner';
  const showScanner = screenMode === 'scanner';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Header
        title="Raffle Giveaway"
        leftIcon="arrow-left"
        onLeftPress={() => router.back()}
        iconSize={SIZES.headerIconSize}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {hasPermission === false && (
          <View style={styles.card}>
            <Text style={styles.body}>Camera access is required to scan booth QR codes.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.88}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {showHubChrome && (
          <>
            <TouchableOpacity style={styles.scanBoothBtn} onPress={openScanner} activeOpacity={0.88}>
              <Icon name="camera" size={20} color={colors.white} style={styles.scanBoothIcon} />
              <Text style={styles.scanBoothBtnText}>Scan booth</Text>
            </TouchableOpacity>

            {screenMode === 'confirm' && booth ? (
              <View style={[styles.card, styles.cardBelow]}>
                <Text style={styles.sectionLabel}>Booth</Text>
                {booth.event_title ? <Text style={styles.eventTitle}>{booth.event_title}</Text> : null}
                <Text style={styles.boothTitle}>
                  {booth.title || '—'} — Booth {booth.booth_no || '—'}
                </Text>
                {booth.company_name ? <Text style={styles.company}>{booth.company_name}</Text> : null}
                {booth.description ? (
                  <Text style={styles.desc}>{stripHtmlLite(String(booth.description))}</Text>
                ) : null}

                <Text style={styles.confirmQ}>Enter the raffle for this booth?</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.choice, styles.choiceNo]}
                    onPress={onNo}
                    disabled={submitting}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.choiceNoText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choice, styles.choiceYes]}
                    onPress={onYes}
                    disabled={submitting}
                    activeOpacity={0.88}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.choiceYesText}>Yes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={styles.listHeading}>Your raffle entries</Text>
            {entries.length === 0 ? (
              <Text style={styles.mutedLeft}>No booths yet.</Text>
            ) : (
              entries.map((item) => (
                <View key={String(item.boothId)} style={styles.listRow}>
                  <View style={styles.listRowText}>
                    <Text style={styles.listTitle} numberOfLines={2}>
                      {item.title || '—'} — Booth {item.boothNo || '—'}
                    </Text>
                    {item.companyName ? <Text style={styles.listCompany}>{item.companyName}</Text> : null}
                    {item.eventTitle ? <Text style={styles.listEvent}>{item.eventTitle}</Text> : null}
                  </View>
                  <Icon name="check-circle" size={20} color={colors.primary} />
                </View>
              ))
            )}
          </>
        )}

        {showScanner && hasPermission && (
          <View style={styles.scanWrap}>
            <View style={styles.scanFrame}>
              {scanning && !loadingDetails && (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
              )}
              {!scanning && !loadingDetails && (
                <View style={styles.scanPlaceholder}>
                  <Icon name="maximize" size={28} color={colors.textMuted} />
                  <Text style={styles.hint}>Align the booth QR code in the frame</Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setScanning(true)} activeOpacity={0.88}>
                    <Text style={styles.primaryBtnText}>Resume scanning</Text>
                  </TouchableOpacity>
                </View>
              )}
              {loadingDetails && (
                <View style={styles.scanPlaceholder}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.hint}>Loading booth…</Text>
                </View>
              )}
            </View>
            <Text style={styles.subHint}>Scan the exhibitor booth QR (same as admin Booth QR).</Text>
            {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
          </View>
        )}

        {screenMode === 'confirm' && booth && !showHubChrome && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Booth</Text>
            {booth.event_title ? <Text style={styles.eventTitle}>{booth.event_title}</Text> : null}
            <Text style={styles.boothTitle}>
              {booth.title || '—'} — Booth {booth.booth_no || '—'}
            </Text>
            {booth.company_name ? <Text style={styles.company}>{booth.company_name}</Text> : null}
            {booth.description ? (
              <Text style={styles.desc}>{stripHtmlLite(String(booth.description))}</Text>
            ) : null}

            <Text style={styles.confirmQ}>Enter the raffle for this booth?</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.choice, styles.choiceNo]}
                onPress={onNo}
                disabled={submitting}
                activeOpacity={0.88}
              >
                <Text style={styles.choiceNoText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, styles.choiceYes]}
                onPress={onYes}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.choiceYesText}>Yes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <ContactSavedSuccessModal
        visible={raffleSuccessVisible}
        title={raffleSuccessTitle}
        message={raffleSuccessMessage}
        onClose={() => setRaffleSuccessVisible(false)}
        showViewContactsButton={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, padding: 24, justifyContent: 'center' },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  scanWrap: { marginBottom: 16 },
  scanFrame: {
    height: 260,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  scanPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  hint: { marginTop: 12, color: colors.text, fontSize: 14, textAlign: 'center' },
  subHint: { marginTop: 10, color: colors.textMuted, fontSize: 13 },
  errorText: { marginTop: 8, color: '#c0392b', fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },
  cardBelow: { marginTop: 16 },
  body: { fontSize: 15, color: colors.text, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  eventTitle: { marginTop: 4, fontSize: 14, color: colors.primary, fontWeight: '600' },
  boothTitle: { marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.text },
  company: { marginTop: 6, fontSize: 15, color: colors.text },
  desc: { marginTop: 10, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  confirmQ: { marginTop: 20, fontSize: 16, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  choice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  choiceNo: { borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.background },
  choiceNoText: { fontSize: 16, fontWeight: '700', color: colors.text },
  choiceYes: { backgroundColor: colors.primary },
  choiceYesText: { fontSize: 16, fontWeight: '700', color: colors.white },
  primaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  scanBoothBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    marginBottom: 20,
  },
  scanBoothIcon: { marginRight: 8 },
  scanBoothBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  listHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    marginTop: 4,
  },
  mutedLeft: { color: colors.textMuted, fontSize: 15, textAlign: 'left' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listRowText: { flex: 1, paddingRight: 12 },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listCompany: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  listEvent: { marginTop: 4, fontSize: 13, color: colors.primary },
});
