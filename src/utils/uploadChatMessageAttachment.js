import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

function buildMobileUrl(endpoint) {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function ensureFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return `file://${uri}`;
}

/**
 * Native multipart upload for chat images/PDF (more reliable than fetch FormData on iOS Expo Go).
 */
export async function uploadChatMessageAttachment({
  isDelegate,
  toId,
  toType,
  message = '',
  uri,
  name = 'photo.jpg',
  mimeType = 'image/jpeg',
}) {
  const token = await AsyncStorage.getItem('auth_token');
  const cleanToken = token ? token.trim().replace(/^["']|["']$/g, '') : '';
  if (!cleanToken) {
    throw new Error('Session expired. Please log in again.');
  }

  const fileUri = ensureFileUri(uri);
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error('File not found. Please capture or select the file again.');
  }

  const endpoint = isDelegate
    ? API_ENDPOINTS.DELEGATE_CHAT_SEND_MESSAGE
    : API_ENDPOINTS.SPONSOR_CHAT_SEND_MESSAGE;
  const url = buildMobileUrl(endpoint);

  const parameters = {
    to_id: String(toId),
    to_type: String(toType),
  };
  const caption = typeof message === 'string' ? message.trim() : '';
  if (caption) {
    parameters.message = caption;
  }

  const response = await FileSystem.uploadAsync(url, fileUri, {
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'attachment',
    mimeType: mimeType || 'image/jpeg',
    parameters,
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/json',
    },
    httpMethod: 'POST',
    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
  });

  const status = response.status ?? 0;
  const bodyText = typeof response.body === 'string' ? response.body : '';

  let parsed = {};
  if (bodyText.trim()) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      if (status >= 200 && status < 300) {
        return { success: true, message: 'Message may have been saved', data: {} };
      }
      throw new Error(bodyText.slice(0, 180) || `Upload failed (HTTP ${status})`);
    }
  }

  if (status >= 200 && status < 300) {
    return parsed;
  }

  const errMsg =
    parsed?.message ||
    parsed?.error ||
    (bodyText ? bodyText.slice(0, 180) : null) ||
    `Upload failed (HTTP ${status})`;
  throw new Error(errMsg);
}
