import * as FileSystem from 'expo-file-system/legacy';

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp)$/i;

/**
 * Ensures camera/gallery picks use a URI + filename the chat API accepts (JPG/PNG, not HEIC).
 */
export async function normalizeChatImageAsset(asset) {
  if (!asset?.uri) return null;

  let uri = asset.uri;
  let name = asset.fileName || uri.split('/').pop()?.split('?')[0] || 'photo.jpg';
  let mimeType = asset.mimeType || 'image/jpeg';

  const isHeic =
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    /\.heic$/i.test(name) ||
    /\.heif$/i.test(uri);

  if (isHeic || !ALLOWED_EXT.test(name)) {
    const dest = `${FileSystem.cacheDirectory}chat_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      uri = dest;
      name = 'photo.jpg';
      mimeType = 'image/jpeg';
    } catch (e) {
      console.warn('normalizeChatImageAsset: copy failed, using original uri', e);
      name = 'photo.jpg';
      mimeType = 'image/jpeg';
    }
  }

  if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
    uri = uri.startsWith('/') ? `file://${uri}` : `file://${uri}`;
  }

  return { uri, name, mimeType };
}
