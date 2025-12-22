/**
 * Centralized API Configuration
 * 
 * This file contains all API-related configuration.
 * To change the API base URL, update the API_BASE_URL constant below.
 */

export const API_BASE_URL = 'https://stage1.events.precision-globe.com/mobile/';
// export const API_BASE_URL = 'https://events.precision-globe.com/mobile/';

// API Endpoints
export const API_ENDPOINTS = {
  DELEGATE_LOGIN: '/auth/delegate-login',

  DELEGATE_EVENTS: '/delegate/events',

  DELEGATE_AGENDA: '/delegate/agenda',

  AGENDA_ITEM_BY_ID: (id) => `/delegate/agenda/item/${id}`,

  DELEGATE_ATTENDEES: '/delegate/attendees',
  
  DELEGATE_ALL_DELEGATES: '/delegate/all-delegates',

  DELEGATE_REVIEW_MEETING_REQUESTS: '/delegate/review-meeting-request',
  DELEGATE_MEETING_REQUEST_ACTION: '/delegate/meeting-request-action',
  DELEGATE_SEND_MEETING_REQUEST: '/delegate/send-meeting-request',
  
  DELEGATE_PROFILE: '/delegate/profile',

  /*
  // Auth (disabled)
  SPONSOR_LOGIN: '/auth/sponsor-login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_EMAIL: '/auth/verify-email',

  // Events (disabled)
  SPONSOR_EVENTS: '/sponsor/events',
  EVENTS: '/events',
  EVENT_BY_ID: (id) => `/events/${id}`,

  // Agenda (disabled)
  SPONSOR_AGENDA: '/sponsor/agenda',
  AGENDA: '/agenda',
  AGENDA_BY_ID: (id) => `/agenda/${id}`,

  // Attendees (disabled)
  SPONSOR_ATTENDEES: '/sponsor/attendees',
  ATTENDEES: '/attendees',
  ATTENDEE_BY_ID: (id) => `/attendees/${id}`,

  // Messages (disabled)
  MESSAGES: '/messages',
  MESSAGE_BY_ID: (id) => `/messages/${id}`,

  // Sponsors (disabled)
  SPONSORS: '/sponsors',
  SPONSOR_BY_ID: (id) => `/sponsors/${id}`,

  // Meeting Requests (disabled)
  MEETING_REQUESTS: '/meeting-requests',
  MEETING_REQUEST_BY_ID: (id) => `/meeting-requests/${id}`,

  // Profile (disabled)
  PROFILE: '/profile',
  CHANGE_PASSWORD: '/profile/change-password',

  // Contacts (disabled)
  CONTACTS: '/contacts',
  */
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
