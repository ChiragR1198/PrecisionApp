import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config/api';

export function buildMobileUrl(endpoint) {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

export function ensureFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return `file://${uri}`;
}

export async function getMobileAuthToken() {
  const token = await AsyncStorage.getItem('auth_token');
  const clean = token ? token.trim().replace(/^["']|["']$/g, '') : '';
  if (!clean) {
    throw new Error('Session expired. Please log in again.');
  }
  return clean;
}

export function parseMobileUploadResponse(response) {
  const status = response.status ?? 0;
  const bodyText = typeof response.body === 'string' ? response.body : '';

  let parsed = {};
  if (bodyText.trim()) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      if (status >= 200 && status < 300) {
        return { success: true, message: 'Saved', data: {} };
      }
      throw new Error(bodyText.slice(0, 180) || `Request failed (HTTP ${status})`);
    }
  }

  if (status >= 200 && status < 300) {
    return parsed;
  }

  const errMsg =
    parsed?.message ||
    parsed?.error ||
    (bodyText ? bodyText.slice(0, 180) : null) ||
    `Request failed (HTTP ${status})`;
  throw new Error(errMsg);
}

/**
 * Native multipart upload (reliable on iOS Expo Go for images).
 */
export async function uploadMultipartToMobile({
  endpoint,
  fileUri,
  fieldName = 'image',
  mimeType = 'image/jpeg',
  parameters = {},
}) {
  const cleanToken = await getMobileAuthToken();
  const normalizedUri = ensureFileUri(fileUri);
  const info = await FileSystem.getInfoAsync(normalizedUri);
  if (!info.exists) {
    throw new Error('File not found. Please select the image again.');
  }

  const url = buildMobileUrl(endpoint);
  const response = await FileSystem.uploadAsync(url, normalizedUri, {
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName,
    mimeType: mimeType || 'image/jpeg',
    parameters,
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    },
    httpMethod: 'POST',
    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
  });

  return parseMobileUploadResponse(response);
}

/**
 * Text-only or small form POST (no file). Does not go through RTK retry loop.
 */
export async function postFormFieldsToMobile({ endpoint, fields }) {
  const cleanToken = await getMobileAuthToken();
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== '') {
      form.append(key, String(value));
    }
  });

  const url = buildMobileUrl(endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    },
    body: form,
  });

  const bodyText = await res.text();
  let parsed = {};
  if (bodyText.trim()) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      if (res.ok) {
        return { success: true, message: 'Saved', data: {} };
      }
      throw new Error(bodyText.slice(0, 180) || `Request failed (HTTP ${res.status})`);
    }
  }

  if (res.ok) {
    return parsed;
  }

  throw new Error(
    parsed?.message || bodyText.slice(0, 180) || `Request failed (HTTP ${res.status})`
  );
}
