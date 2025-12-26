import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// Base query with token injection
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: async (headers) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Accept', 'application/json');
    if (!headers.get('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  },
});

// Shared in-flight refresh promise to prevent parallel refresh calls
let refreshPromise = null;

// Enhanced base query with error handling + automatic re-auth
const baseQueryWithErrorHandling = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  // If unauthorized, try to refresh token once
  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
          const refreshBody = storedRefreshToken ? { refresh_token: storedRefreshToken } : undefined;
          const refreshResult = await baseQuery({
            url: API_ENDPOINTS.REFRESH_TOKEN,
            method: 'POST',
            body: refreshBody,
          }, api, extraOptions);

          const newToken = refreshResult?.data?.token || refreshResult?.data?.data?.token;
          const newRefreshToken = refreshResult?.data?.refresh_token || refreshResult?.data?.data?.refresh_token;

          if (newToken) {
            await AsyncStorage.setItem('auth_token', newToken);
            if (newRefreshToken) {
              await AsyncStorage.setItem('refresh_token', newRefreshToken);
            }
            return true;
          }
        } catch (e) {
          // no-op, will fall through to logout
        }
        // Refresh failed; clear and force re-login
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('auth_user');
        return false;
      })().finally(() => {
        // allow future refresh attempts
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry the original query with new token
      result = await baseQuery(args, api, extraOptions);
    }
  }

  if (result.error) {
    const { status, data } = result.error;
    let errorMessage = `HTTP error! status: ${status}`;

    if (data) {
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = typeof data.error === 'string' ? data.error : data.error.message || errorMessage;
      } else if (data.errors && Array.isArray(data.errors)) {
        errorMessage = data.errors[0]?.message || data.errors[0] || errorMessage;
      } else if (data.msg) {
        errorMessage = data.msg;
      } else if (data.data?.message) {
        errorMessage = data.data.message;
      }
    }

    return { error: { status, data, message: errorMessage } };
  }

  return result;
};

// Single API slice for the entire app
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithErrorHandling,
  tagTypes: ['Auth', 'Events', 'Agenda', 'Attendees', 'Messages', 'Sponsors', 'MeetingRequests', 'Profile', 'Contacts'],
  endpoints: (builder) => ({
    // ============ AUTH ============
    login: builder.mutation({
      query: ({ email, password, userType = 'delegate' }) => ({
        url: userType === 'delegate' ? API_ENDPOINTS.DELEGATE_LOGIN : '/auth/sponsor-login',
        method: 'POST',
        body: { email, password, login_type: userType },
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const token = data?.token || data?.data?.token;
          const refreshToken = data?.refresh_token || data?.data?.refresh_token;
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
          }
          if (refreshToken) {
            await AsyncStorage.setItem('refresh_token', refreshToken);
          }
          await AsyncStorage.setItem('auth_user', JSON.stringify(data.data || data));
        } catch (error) {
          console.error('Login token storage failed:', error);
        }
      },
    }),
    
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.warn('Logout API failed, clearing local data anyway');
        } finally {
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('auth_user');
        }
      },
    }),
    
    forgotPassword: builder.mutation({
      query: (email) => ({
        url: API_ENDPOINTS.AUTH_DELEGATE_FORGOT_PASSWORD,
        method: 'POST',
        body: { email },
      }),
    }),
    
    resetPassword: builder.mutation({
      query: ({ email, otp, new_password, confirm_password }) => ({
        url: API_ENDPOINTS.AUTH_DELEGATE_RESET_PASSWORD,
        method: 'POST',
        body: { email, otp, new_password, confirm_password },
      }),
    }),
    
    verifyEmail: builder.mutation({
      query: ({ email, otp, user_type = 'delegate' }) => ({
        url: API_ENDPOINTS.AUTH_VERIFY_FORGOT_PASSWORD_OTP,
        method: 'POST',
        body: { email, otp, user_type },
      }),
    }),
    
    register: builder.mutation({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    
    // ============ EVENTS ============
    getEvents: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_EVENTS,
      providesTags: ['Events'],
    }),
    
    getEventDetails: builder.query({
      query: (eventId) => `/events/${eventId}`,
      providesTags: (result, error, eventId) => [{ type: 'Events', id: eventId }],
    }),
    
    // ============ AGENDA ============
    getAgenda: builder.query({
      query: (eventId) => {
        // API endpoint format: /agenda/{eventId}
        // Example: https://stage1.events.precision-globe.com/mobile/agenda/27
        if (eventId) {
          return API_ENDPOINTS.AGENDA_BY_ID(eventId);
        }
        // Fallback to delegate agenda if no eventId provided
        return API_ENDPOINTS.AGENDA;
      },
      
      providesTags: ['Agenda'],
    }),
    
    getAgendaDetails: builder.query({
      query: (agendaId) => {
        if (agendaId) {
          return API_ENDPOINTS.AGENDA_ITEM_BY_ID(agendaId);
        }
        return null;
      },
      providesTags: (result, error, agendaId) => [{ type: 'Agenda', id: agendaId }],
    }),
    
    // ============ ATTENDEES ============
    getAttendees: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_ATTENDEES,
      providesTags: ['Attendees'],
    }),
    
    getAllDelegates: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_ALL_DELEGATES,
      providesTags: ['Attendees'],
    }),
    
    getAttendeeDetails: builder.query({
      query: (attendeeId) => `/attendees/${attendeeId}`,
      providesTags: (result, error, attendeeId) => [{ type: 'Attendees', id: attendeeId }],
    }),
    
    // ============ MESSAGES ============
    getMessages: builder.query({
      query: () => '/messages',
      providesTags: ['Messages'],
    }),
    
    getMessageThread: builder.query({
      query: (threadId) => `/messages/${threadId}`,
      providesTags: (result, error, threadId) => [{ type: 'Messages', id: threadId }],
    }),
    
    sendMessage: builder.mutation({
      query: ({ recipientId, message }) => ({
        url: '/messages',
        method: 'POST',
        body: { recipient_id: recipientId, message },
      }),
      invalidatesTags: ['Messages'],
    }),
    
    // ============ SPONSORS ============
    getSponsors: builder.query({
      query: () => '/sponsors',
      providesTags: ['Sponsors'],
    }),
    
    getSponsorDetails: builder.query({
      query: (sponsorId) => `/sponsors/${sponsorId}`,
      providesTags: (result, error, sponsorId) => [{ type: 'Sponsors', id: sponsorId }],
    }),
    
    // ============ MEETING REQUESTS ============
    getMeetingRequests: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_REVIEW_MEETING_REQUESTS,
      providesTags: ['MeetingRequests'],
    }),
    
    createMeetingRequest: builder.mutation({
      query: (requestData) => ({
        url: API_ENDPOINTS.DELEGATE_SEND_MEETING_REQUEST,
        method: 'POST',
        body: requestData,
      }),
      invalidatesTags: ['MeetingRequests'],
    }),
    
    updateMeetingRequest: builder.mutation({
      query: ({ id, status }) => ({
        url: API_ENDPOINTS.DELEGATE_MEETING_REQUEST_ACTION,
        method: 'POST',
        body: { meeting_request_id: id, action: status === 'accepted' ? 1 : 0 },
      }),
      invalidatesTags: ['MeetingRequests'],
    }),
    
    // ============ PROFILE ============
    getProfile: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_PROFILE,
      providesTags: ['Profile'],
    }),
    
    updateProfile: builder.mutation({
      query: (profileData) => ({
        url: API_ENDPOINTS.DELEGATE_PROFILE_UPDATE,
        method: 'POST',
        body: profileData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
      invalidatesTags: ['Profile'],
    }),
    
    changePassword: builder.mutation({
      query: ({ currentPassword, newPassword, confirmPassword }) => ({
        url: '/profile/change-password',
        method: 'PUT',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        },
      }),
    }),
    
    // ============ CONTACTS ============
    getContacts: builder.query({
      query: () => '/contacts',
      providesTags: ['Contacts'],
    }),
    
    // ============ ITINERARY ============
    getItinerary: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_VIEW_ITINERARY,
      providesTags: ['Agenda'],
    }),
  }),
});

// Export hooks for usage in components
export const {
  // Auth
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useRegisterMutation,
  // Events
  useGetEventsQuery,
  useGetEventDetailsQuery,
  // Agenda
  useGetAgendaQuery,
  useGetAgendaDetailsQuery,
  // Attendees
  useGetAttendeesQuery,
  useGetAllDelegatesQuery,
  useGetAttendeeDetailsQuery,
  // Messages
  useGetMessagesQuery,
  useGetMessageThreadQuery,
  useSendMessageMutation,
  // Sponsors
  useGetSponsorsQuery,
  useGetSponsorDetailsQuery,
  // Meeting Requests
  useGetMeetingRequestsQuery,
  useCreateMeetingRequestMutation,
  useUpdateMeetingRequestMutation,
  // Profile
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  // Contacts
  useGetContactsQuery,
  // Itinerary
  useGetItineraryQuery,
} = api;
