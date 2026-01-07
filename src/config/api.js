/**
 * Centralized API Configuration
 * 
 * This file contains all API-related configuration.
 * To change the API base URL, update the API_BASE_URL constant below.
 */

export const API_BASE_URL = 'https://stage1.events.precision-globe.com/mobile/';
// export const API_BASE_URL = 'https://events.precision-globe.com/mobile/';

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
  DELEGATE_PROFILE: '/delegate/profile',
  DELEGATE_PROFILE_UPDATE: '/delegate/profile/update',
  DELEGATE_VIEW_ITINERARY: '/delegate/view-itinerary',
  
  // Delegate Meeting Requests
  DELEGATE_REVIEW_MEETING_REQUESTS: '/delegate/review-meeting-request',
  DELEGATE_SEND_MEETING_REQUEST: '/delegate/send-meeting-request',
  DELEGATE_MEETING_REQUEST_ACTION: '/delegate/meeting-request-action',

  // Delegate Messages
  DELEGATE_CHAT_SEND_MESSAGE: '/delegate/chat/send-message',
  DELEGATE_CHAT_MESSAGE_LIST: '/delegate/chat/all-messages',
  DELEGATE_CHAT_MESSAGES: '/delegate/chat/messages', // Get messages with specific user (query param: to_id)
  
  // Delegate Contacts
  DELEGATE_CONTACTS: '/delegate/contacts',
  DELEGATE_SAVE_CONTACT: '/delegate/save-contact',
  DELEGATE_DELETE_CONTACT: '/delegate/delete-contact',

  // ============ SPONSOR ENDPOINTS ============
  SPONSOR_EVENTS: '/sponsor/events',
  SPONSOR_EVENT_SPONSOR: (id) => `/sponsor/event-sponsor/${id}`,
  SPONSOR_MEETING_REQUEST_FROM_DELEGATE: '/sponsor/meeting-request-from-delegate',
  SPONSOR_SEND_MEETING_REQUEST: '/sponsor/send-meeting-request',
  SPONSOR_MEETING_REQUEST_ACTION: '/sponsor/meeting-request-action',
  SPONSOR_SERVICES: '/sponsor/services', // Query param: event_id
  SPONSOR_ALL_ATTENDEES: '/sponsor/all-attendees',
  SPONSOR_VIEW_ITINERARY: '/sponsor/view-itinerary',
  SPONSOR_PROFILE: '/sponsor/profile',
  SPONSOR_PROFILE_UPDATE: '/sponsor/profile/update',
  SPONSOR_CHAT_SEND_MESSAGE: '/sponsor/chat/send-message',
  SPONSOR_CHAT_MESSAGE_LIST: '/sponsor/chat/all-messages',
  SPONSOR_CHAT_MESSAGES: '/sponsor/chat/messages',
  
  // Sponsor Contacts
  SPONSOR_DELETE_CONTACT: '/sponsor/delete-contact',

  // ============ AGENDA ============
  AGENDA_BY_ID: (id) => `/agenda/${id}`,
  AGENDA_ITEM_BY_ID: (id) => `/agenda/item/${id}`,
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
