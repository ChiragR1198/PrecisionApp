import { API_ENDPOINTS } from '../config/api';
import { postFormFieldsToMobile, uploadMultipartToMobile } from './multipartMobileUpload';

function contactNotesEndpoint(role) {
  return role === 'sponsor'
    ? API_ENDPOINTS.SPONSOR_CONTACT_NOTES
    : API_ENDPOINTS.DELEGATE_CONTACT_NOTES;
}

export async function saveContactNote({ contactId, role, notes, image }) {
  const text = typeof notes === 'string' ? notes.trim() : '';
  if (!contactId) {
    throw new Error('Missing contact.');
  }
  if (!text && !image?.uri) {
    throw new Error('Enter a note or upload an image before saving.');
  }

  const endpoint = contactNotesEndpoint(role);
  const fields = { contact_id: String(contactId) };
  if (text) {
    fields.notes = text;
  }

  if (image?.uri) {
    return uploadMultipartToMobile({
      endpoint,
      fileUri: image.uri,
      fieldName: 'image',
      mimeType: image.mimeType || 'image/jpeg',
      parameters: fields,
    });
  }

  return postFormFieldsToMobile({ endpoint, fields });
}
