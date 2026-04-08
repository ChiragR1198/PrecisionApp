/**
 * Centralized API Configuration
 * 
 * This file contains all API-related configuration.
 * To change the API base URL, update the API_BASE_URL constant below.
 */

// Token jis backend par save hota hai, wahi DB mein dikhega (e.g. local DB = local URL use karo)
// export const API_BASE_URL = 'https://stage1.events.precision-globe.com/mobile/';
export const API_BASE_URL = 'https://events.precision-globe.com/mobile/';
// Local testing (MAMP): tokens localhost DB (mobile_device_tokens) mein save honge
// export const API_BASE_URL = 'http://localhost:8888/precision-backend/mobile/';

// API Endpoints - Only endpoints from Postman Collection
export const API_ENDPOINTS = {
  // ============ AUTH ============
  DELEGATE_LOGIN: '/auth/delegate-login',
  SPONSOR_LOGIN: '/auth/sponsor-login',
  DELEGATE_LOGOUT: '/auth/delegate-logout',
  SPONSOR_LOGOUT: '/auth/sponsor-logout',
  // REFRESH_TOKEN: '/auth/refresh-token',
  
  // Password Reset (Delegate)
  AUTH_DELEGATE_FORGOT_PASSWORD: '/auth/delegate-forgot-password',
  AUTH_VERIFY_FORGOT_PASSWORD_OTP: '/auth/verify-forgot-password-otp',
  AUTH_DELEGATE_RESET_PASSWORD: '/auth/delegate-reset-password',
  AUTH_DELEGATE_CHANGE_PASSWORD: '/auth/delegate-change-password',
  
  // Password Reset (Sponsor)
  AUTH_SPONSOR_FORGOT_PASSWORD: '/auth/sponsor-forgot-password',
  AUTH_SPONSOR_RESET_PASSWORD: '/auth/sponsor-reset-password',
  AUTH_SPONSOR_CHANGE_PASSWORD: '/auth/sponsor-change-password',

  // ============ DELEGATE ENDPOINTS ============
  DELEGATE_EVENTS: '/delegate/events',
  DELEGATE_ATTENDEES: '/delegate/attendees',
  DELEGATE_ALL_DELEGATES: '/delegate/all-delegates',
  /** Same service labels as sponsor filter; uses delegate auth */
  DELEGATE_EVENT_SERVICES: '/delegate/event-services',
  DELEGATE_PROFILE: '/delegate/profile',
  DELEGATE_PROFILE_UPDATE: '/delegate/profile/update',
  DELEGATE_VIEW_ITINERARY: '/delegate/view-itinerary',
  DELEGATE_DELETE_ITINERARY_MEETING: '/delegate/delete-itinerary-meeting',
  DELEGATE_MODIFY_ITINERARY_MEETING: '/delegate/modify-itinerary-meeting',
  /** Dashboard: sponsor_logo rows for current event (same as web) */
  DELEGATE_EVENT_SPONSOR_LOGOS: '/delegate/event-sponsor-logos',
  // Delegate Meeting Times
  DELEGATE_MEETING_TIMES: '/delegate/meeting-times',
  DELEGATE_MEETING_LOCATIONS: '/delegate/meeting-locations',
  
  // Delegate Meeting Requests
  DELEGATE_REVIEW_MEETING_REQUESTS: '/delegate/review-meeting-request',
  DELEGATE_SEND_MEETING_REQUEST: '/delegate/send-meeting-request',
  DELEGATE_SEND_MEETING_REQUEST_TO_DELEGATE: '/delegate/send-meeting-request-to-delegate',
  DELEGATE_MEETING_REQUEST_ACTION: '/delegate/meeting-request-action',
  /** Delegate's sent requests: sponsor accepted/declined (shows Accepted/Declined on Event Sponsors) */
  DELEGATE_MEETING_REQUEST_ACCEPTED_BY_SPONSOR: '/delegate/meeting-request-accepted-by-sponsor',

  // Delegate Messages
  DELEGATE_CHAT_SEND_MESSAGE: '/delegate/chat/send-message',
  DELEGATE_CHAT_MESSAGE_LIST: '/delegate/chat/all-messages',
  DELEGATE_CHAT_MESSAGES: '/delegate/chat/messages', // query: to_id, to_type (delegate|sponsor)
  
  // Delegate Contacts
  DELEGATE_CONTACTS: '/delegate/contacts',
  DELEGATE_SAVE_CONTACT: '/delegate/save-contact',
  DELEGATE_DELETE_CONTACT: '/delegate/delete-contact',

  // ============ SPONSOR ENDPOINTS ============
  SPONSOR_EVENTS: '/sponsor/events',
  SPONSOR_EVENT_SPONSOR: (id) => `/sponsor/event-sponsor/${id}`,
  SPONSOR_MEETING_REQUEST_FROM_DELEGATE: '/sponsor/meeting-request-from-delegate',
  SPONSOR_SEND_MEETING_REQUEST: '/sponsor/send-meeting-request',
  // Sponsor -> Sponsor meeting request
  SPONSOR_SEND_MEETING_REQUEST_TO_SPONSOR: '/sponsor/send-meeting-request-to-sponsor',
  SPONSOR_MEETING_REQUEST_ACTION: '/sponsor/meeting-request-action',
  /** Sponsor's sent requests: delegate accepted/declined (shows Accepted/Declined on Event Delegates) */
  SPONSOR_MEETING_REQUEST_ACCEPTED_BY_DELEGATE: '/sponsor/meeting-request-accepted-by-delegate',
  SPONSOR_SERVICES: '/sponsor/services', // Query param: event_id
  SPONSOR_ALL_ATTENDEES: '/sponsor/all-attendees',
  SPONSOR_VIEW_ITINERARY: '/sponsor/view-itinerary',
  SPONSOR_DELETE_ITINERARY_MEETING: '/sponsor/delete-itinerary-meeting',
  SPONSOR_MODIFY_ITINERARY_MEETING: '/sponsor/modify-itinerary-meeting',
  /** Dashboard: sponsor_logo rows for current event (same as web) */
  SPONSOR_EVENT_SPONSOR_LOGOS: '/sponsor/event-sponsor-logos',
  SPONSOR_PROFILE: '/sponsor/profile',
  SPONSOR_PROFILE_UPDATE: '/sponsor/profile/update',
  SPONSOR_CHAT_SEND_MESSAGE: '/sponsor/chat/send-message',
  SPONSOR_CHAT_MESSAGE_LIST: '/sponsor/chat/all-messages',
  SPONSOR_CHAT_MESSAGES: '/sponsor/chat/messages',
  // Sponsor Meeting Times
  SPONSOR_MEETING_TIMES: '/sponsor/meeting-times',
  SPONSOR_MEETING_LOCATIONS: '/sponsor/meeting-locations',
  
  // Sponsor Contacts
  SPONSOR_CONTACTS: '/sponsor/contacts',
  SPONSOR_SAVE_CONTACT: '/sponsor/save-contact',
  SPONSOR_DELETE_CONTACT: '/sponsor/delete-contact',

  // ============ AGENDA ============
  AGENDA_BY_ID: (id) => `/agenda/${id}`,
  AGENDA_ITEM_BY_ID: (id) => `/agenda/item/${id}`,
  AGENDA_CHECK_IN: '/agenda/check-in',
  AGENDA_CHECK_IN_STATUS: '/agenda/check-in-status',

  // ============ PUSH NOTIFICATIONS ============
  PUSH_REGISTER_TOKEN: 'push/register-token',

  /** In-app inbox (last notifications, read/unread) — requires Bearer */
  NOTIFICATIONS_INBOX: 'notifications/inbox',
  NOTIFICATIONS_UNREAD_COUNT: 'notifications/unread-count',
  NOTIFICATIONS_MARK_READ: 'notifications/mark-read',
  NOTIFICATIONS_DELETE: 'notifications/delete',

  // ============ CONTACT US ============
  CONTACT_SUBMIT: 'contact/submit',

  // Presence (active session — same token as rest of app)
  PRESENCE_PING: '/presence/ping',
  PRESENCE_ONLINE: '/presence/online',

  /** Public GET — no auth. Used by ForceUpdateGate (min version / store URLs). */
  APP_VERSION: 'app-version',
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
