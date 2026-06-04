import { API_ENDPOINTS } from '../config/api';
import { postFormFieldsToMobile, uploadMultipartToMobile } from './multipartMobileUpload';

/**
 * Save agenda session note (text and/or image). Uses native upload when image is present.
 */
export async function saveAgendaSessionNote({ agendaId, notes, image }) {
  const text = typeof notes === 'string' ? notes.trim() : '';
  if (!agendaId) {
    throw new Error('Missing session.');
  }
  if (!text && !image?.uri) {
    throw new Error('Enter a note or upload an image before saving.');
  }

  const fields = { agenda_id: String(agendaId) };
  if (text) {
    fields.notes = text;
  }

  if (image?.uri) {
    return uploadMultipartToMobile({
      endpoint: API_ENDPOINTS.AGENDA_SESSION_NOTES,
      fileUri: image.uri,
      fieldName: 'image',
      mimeType: image.mimeType || 'image/jpeg',
      parameters: fields,
    });
  }

  return postFormFieldsToMobile({
    endpoint: API_ENDPOINTS.AGENDA_SESSION_NOTES,
    fields,
  });
}
