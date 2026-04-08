import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Exports CSV with UTF-8 BOM.
 * - Android: tries Storage Access Framework (user picks folder, e.g. Downloads) so the file is saved without only relying on the share sheet; falls back to cache + share.
 * - iOS: writes to cache and opens the share sheet (user can “Save to Files”).
 *
 * @param {object} opts
 * @param {string} opts.csvBody - Raw CSV (no BOM); BOM is added here.
 * @param {string} opts.fileName - Must end in .csv (e.g. delegates_2026-04-04-12-00-00.csv).
 * @param {string} [opts.fallbackDialogTitle] - Share intent title when falling back on Android.
 */
export async function exportCsvNative({ csvBody, fileName, fallbackDialogTitle = 'Save or share CSV' }) {
  const csv = `\uFEFF${csvBody}`;
  const safeName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const baseNoExt = safeName.replace(/\.csv$/i, '');

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
    try {
      const initialDir = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot
        ? FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download')
        : null;
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialDir);
      if (perm.granted) {
        const dest = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri,
          baseNoExt,
          'text/csv'
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(dest, csv, { encoding: 'utf8' });
        Alert.alert('Saved', 'CSV saved to the folder you selected (e.g. Downloads).');
        return;
      }
    } catch (e) {
      console.warn('exportCsvNative SAF:', e);
    }

    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert('Export failed', 'File storage is not available on this device.');
      return;
    }
    const uri = `${baseDir}${safeName}`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: fallbackDialogTitle });
    } else {
      Alert.alert('Exported', `Saved:\n${uri}`);
    }
    return;
  }

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    Alert.alert('Export failed', 'File storage is not available on this device.');
    return;
  }
  const uri = `${baseDir}${safeName}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: fallbackDialogTitle });
  } else {
    Alert.alert('Exported', `Saved:\n${uri}`);
  }
}
