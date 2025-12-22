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
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

// Enhanced base query with error handling
const baseQueryWithErrorHandling = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  
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
          if (data?.token) {
            await AsyncStorage.setItem('auth_token', data.token);
            await AsyncStorage.setItem('auth_user', JSON.stringify(data.data || data));
          }
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
          await AsyncStorage.removeItem('auth_user');
        }
      },
    }),
    
    forgotPassword: builder.mutation({
      query: (email) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),
    
    resetPassword: builder.mutation({
      query: ({ token, password, password_confirmation }) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: { token, password, password_confirmation },
      }),
    }),
    
    verifyEmail: builder.mutation({
      query: ({ email, otp }) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body: { email, otp },
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
      query: (eventId) => eventId ? `${API_ENDPOINTS.DELEGATE_AGENDA}/${eventId}` : API_ENDPOINTS.DELEGATE_AGENDA,
      providesTags: ['Agenda'],
    }),
    
    getAgendaDetails: builder.query({
      query: (agendaId) => API_ENDPOINTS.AGENDA_ITEM_BY_ID(agendaId),
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
        url: API_ENDPOINTS.DELEGATE_PROFILE,
        method: 'PUT',
        body: profileData,
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
      query: () => '/itinerary',
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
