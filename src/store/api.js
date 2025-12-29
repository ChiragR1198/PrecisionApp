import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// Base query with token injection
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  // Increase timeout for slow networks
  timeout: 30000, // 30 seconds
  prepareHeaders: async (headers) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        // Remove any extra whitespace or quotes from token
        const cleanToken = token.trim().replace(/^["']|["']$/g, '');
        headers.set('Authorization', `Bearer ${cleanToken}`);
        console.log('✅ Token added to request headers');
      } else {
        console.warn('⚠️ No auth token found in AsyncStorage');
      }
    } catch (error) {
      console.error('❌ Error retrieving token:', error);
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
  // Check token before making request
  const tokenBeforeRequest = await AsyncStorage.getItem('auth_token');
  console.log('🌐 API Request:', args.url || args, 'Token present:', tokenBeforeRequest ? 'Yes' : 'No');
  
  // For authenticated endpoints (not login/logout), ensure token is available
  const isAuthEndpoint = args.url?.includes('/auth/') || args.url?.includes('/login') || args.url?.includes('/logout');
  if (!isAuthEndpoint && !tokenBeforeRequest) {
    // Silently skip if no token (user might have logged out)
    // Don't log error as this is expected behavior after logout
    return {
      error: {
        status: 'NO_TOKEN',
        data: { message: 'Authentication token is required' },
        message: 'Authentication token is required',
      },
    };
  }
  
  let result = await baseQuery(args, api, extraOptions);

  // Log error details
  if (result.error) {
    const errorStatus = result.error.status;
    const isFetchError = errorStatus === 'FETCH_ERROR';
    
    console.error('❌ API Error:', {
      url: args.url || args,
      status: errorStatus,
      message: result.error.data?.message || result.error.message || (isFetchError ? 'Network error - check connectivity' : 'Unknown error'),
      data: result.error.data,
    });
    
    // For FETCH_ERROR, retry with exponential backoff (might be timing/network issue)
    if (isFetchError && !isAuthEndpoint) {
      const maxRetries = 2;
      let retryCount = 0;
      
      while (retryCount < maxRetries && result.error && result.error.status === 'FETCH_ERROR') {
        const delay = 500 * Math.pow(2, retryCount); // 500ms, 1000ms
        console.warn(`⚠️ Network error detected - retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        result = await baseQuery(args, api, extraOptions);
        retryCount++;
        
        if (!result.error) {
          console.log('✅ Retry successful');
          break;
        }
      }
      
      if (result.error && result.error.status === 'FETCH_ERROR') {
        console.error('❌ All retries failed - network issue persists. Please check your connection.');
      }
    }
  }

  // If unauthorized, try to refresh token once
  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    console.log('🔄 Token expired (401/403) - Attempting to refresh token...');
    
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
          
          if (!storedRefreshToken) {
            console.error('❌ No refresh token available - user needs to login again');
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('auth_user');
            return false;
          }
          
          console.log('🔄 Calling refresh token API...');
          const refreshBody = { refresh_token: storedRefreshToken };
          const refreshResult = await baseQuery(
            {
              url: API_ENDPOINTS.REFRESH_TOKEN,
              method: 'POST',
              body: refreshBody,
            },
            api,
            extraOptions
          );

          if (refreshResult.error) {
            console.error('❌ Refresh token API failed:', refreshResult.error);
            // Refresh failed; clear and force re-login
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('auth_user');
            return false;
          }

          // Refresh token API response structure:
          // { success: true, message: "...", token: "...", expires_at: "...", data: {...} }
          const responseData = refreshResult?.data || {};
          const newToken = responseData?.token || responseData?.data?.token;
          const expiresAt = responseData?.expires_at;
          
          // Note: Refresh token API doesn't return new refresh_token in response
          // We keep using the same refresh_token for future refreshes

          if (newToken) {
            await AsyncStorage.setItem('auth_token', newToken);
            // Store the same new token as refresh_token (backend uses same token for refresh)
            await AsyncStorage.setItem('refresh_token', newToken);
            console.log('✅ New token stored successfully');
            console.log('✅ New refresh token stored (same as access token)');
            
            if (expiresAt) {
              console.log('📅 Token expires at:', expiresAt);
              // Optionally store expires_at for proactive refresh
              await AsyncStorage.setItem('token_expires_at', expiresAt);
            }
            
            return true;
          } else {
            console.error('❌ No token received from refresh API');
            console.error('Refresh API response:', JSON.stringify(responseData, null, 2));
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('auth_user');
            return false;
          }
        } catch (e) {
          console.error('❌ Error during token refresh:', e);
          // Refresh failed; clear and force re-login
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('auth_user');
          return false;
        }
      })().finally(() => {
        // allow future refresh attempts
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      console.log('✅ Token refreshed successfully - retrying original request...');
      // Retry the original query with new token
      result = await baseQuery(args, api, extraOptions);
      
      if (!result.error) {
        console.log('✅ Request successful after token refresh');
      } else {
        console.error('❌ Request failed even after token refresh:', result.error);
      }
    } else {
      console.error('❌ Token refresh failed - user needs to login again');
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
// All APIs from config/api.js are implemented here
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithErrorHandling,
  // Don't refetch queries on reconnect after logout
  refetchOnReconnect: false,
  tagTypes: [
    'Auth',
    'Events',
    'Agenda',
    'Attendees',
    'Messages',
    'Sponsors',
    'MeetingRequests',
    'Profile',
    'Contacts',
  ],
  endpoints: (builder) => ({
    // ============ AUTH ============
    // 1. Delegate Login
    delegateLogin: builder.mutation({
      query: ({ email, password, login_type = 'delegate' }) => ({
        url: API_ENDPOINTS.DELEGATE_LOGIN,
        method: 'POST',
        body: { email, password, login_type },
      }),
      invalidatesTags: ['Auth', 'Profile'],
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          
          // Log full response structure for debugging
          console.log('🔐 Delegate Login - Full response:', JSON.stringify(data, null, 2));
          
          // Try multiple possible field names for token
          const token = data?.token || data?.data?.token || data?.access_token || data?.accessToken;
          // Try multiple possible field names for refresh token
          const refreshToken = data?.refresh_token || data?.data?.refresh_token || data?.refreshToken || data?.refresh_token || data?.refresh;
          
          console.log('🔐 Delegate Login - Token received:', token ? 'Yes' : 'No');
          console.log('🔐 Delegate Login - RefreshToken received:', refreshToken ? 'Yes' : 'No');
          
          // If no refresh token in response, log available fields
          if (!refreshToken) {
            console.warn('⚠️ No refresh token found. Available fields:', Object.keys(data || {}));
          }
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            // Store the same token as refresh_token (backend uses same token for refresh)
            await AsyncStorage.setItem('refresh_token', token);
            const storedToken = await AsyncStorage.getItem('auth_token');
            const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
            console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
            console.log('✅ Refresh token stored (same as access token):', storedRefreshToken ? 'Yes' : 'No');
          } else {
            console.error('❌ No token received in login response');
          }
          
          // Note: Backend uses the same token for both access and refresh
          // If separate refreshToken is provided, use it; otherwise use token as refresh_token
          if (refreshToken && refreshToken !== token) {
            await AsyncStorage.setItem('refresh_token', refreshToken);
            console.log('✅ Separate refresh token stored');
          }
          await AsyncStorage.setItem('auth_user', JSON.stringify(data.data || data));
          
          // Reset entire RTK Query cache to ensure fresh data for new user
          // Add delay to ensure token is fully stored and network is ready
          setTimeout(() => {
            dispatch(api.util.resetApiState());
          }, 500); // Increased delay to 500ms for better network stability
        } catch (error) {
          console.error('Login token storage failed:', error);
        }
      },
    }),

    // 2. Sponsor Login
    sponsorLogin: builder.mutation({
      query: ({ email, password, login_type = 'sponsor' }) => ({
        url: API_ENDPOINTS.SPONSOR_LOGIN,
        method: 'POST',
        body: { email, password, login_type },
      }),
      invalidatesTags: ['Auth', 'Profile'],
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          
          // Log full response structure for debugging
          console.log('🔐 Sponsor Login - Full response:', JSON.stringify(data, null, 2));
          
          // Try multiple possible field names for token
          const token = data?.token || data?.data?.token || data?.access_token || data?.accessToken;
          // Try multiple possible field names for refresh token
          const refreshToken = data?.refresh_token || data?.data?.refresh_token || data?.refreshToken || data?.refresh_token || data?.refresh;
          
          console.log('🔐 Sponsor Login - Token received:', token ? 'Yes' : 'No');
          console.log('🔐 Sponsor Login - RefreshToken received:', refreshToken ? 'Yes' : 'No');
          
          // If no refresh token in response, log available fields
          if (!refreshToken) {
            console.warn('⚠️ No refresh token found. Available fields:', Object.keys(data || {}));
          }
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            // Store the same token as refresh_token (backend uses same token for refresh)
            await AsyncStorage.setItem('refresh_token', token);
            const storedToken = await AsyncStorage.getItem('auth_token');
            const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
            console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
            console.log('✅ Refresh token stored (same as access token):', storedRefreshToken ? 'Yes' : 'No');
          } else {
            console.error('❌ No token received in login response');
          }
          
          // Note: Backend uses the same token for both access and refresh
          // If separate refreshToken is provided, use it; otherwise use token as refresh_token
          if (refreshToken && refreshToken !== token) {
            await AsyncStorage.setItem('refresh_token', refreshToken);
            console.log('✅ Separate refresh token stored');
          }
          await AsyncStorage.setItem('auth_user', JSON.stringify(data.data || data));
          
          // Reset entire RTK Query cache to ensure fresh data for new user
          // Add delay to ensure token is fully stored and network is ready
          setTimeout(() => {
            dispatch(api.util.resetApiState());
          }, 500); // Increased delay to 500ms for better network stability
        } catch (error) {
          console.error('Login token storage failed:', error);
        }
      },
    }),

    // Refresh Token
    refreshToken: builder.mutation({
      query: (refreshToken) => ({
        url: API_ENDPOINTS.REFRESH_TOKEN,
        method: 'POST',
        body: refreshToken ? { refresh_token: refreshToken } : undefined,
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Refresh token API response: { success, message, token, expires_at, data }
          const newToken = data?.token || data?.data?.token;
          const expiresAt = data?.expires_at;
          
          if (newToken) {
            await AsyncStorage.setItem('auth_token', newToken);
            // Store the same new token as refresh_token (backend uses same token for refresh)
            await AsyncStorage.setItem('refresh_token', newToken);
            console.log('✅ Token refreshed via mutation');
            console.log('✅ Refresh token updated (same as access token)');
            
            if (expiresAt) {
              await AsyncStorage.setItem('token_expires_at', expiresAt);
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      },
    }),

    // Delegate Logout
    delegateLogout: builder.mutation({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_LOGOUT,
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'Profile'],
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.warn('Delegate logout API failed, clearing local data anyway');
        } finally {
          // Clear AsyncStorage first
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('auth_user');
          await AsyncStorage.removeItem('token_expires_at');
          
          // Clear entire RTK Query cache on logout
          // Use longer delay to allow active queries to complete/abort gracefully
          // Also invalidate all tags to prevent refetching
          dispatch(api.util.invalidateTags(['Auth', 'Profile', 'Events', 'Agenda', 'Attendees', 'Messages', 'Sponsors', 'MeetingRequests', 'Contacts']));
          
          setTimeout(() => {
            try {
              dispatch(api.util.resetApiState());
              console.log('✅ Logout complete - cache cleared');
            } catch (error) {
              // Ignore AbortSignal errors - they occur when resetApiState aborts active queries
              // This is expected behavior and doesn't affect functionality
              if (error?.message?.includes('AbortSignal') || error?.message?.includes('abort') || error?.name === 'TypeError') {
                // Silently ignore - this is expected when aborting active queries
                console.log('ℹ️ Cache cleared (active queries aborted)');
              } else {
                console.warn('⚠️ Error clearing cache:', error);
              }
            }
          }, 500); // Increased delay to 500ms for better stability
        }
      },
    }),

    // Sponsor Logout
    sponsorLogout: builder.mutation({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_LOGOUT,
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'Profile'],
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.warn('Sponsor logout API failed, clearing local data anyway');
        } finally {
          // Clear AsyncStorage first
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('auth_user');
          await AsyncStorage.removeItem('token_expires_at');
          
          // Clear entire RTK Query cache on logout
          // Use longer delay to allow active queries to complete/abort gracefully
          // Also invalidate all tags to prevent refetching
          dispatch(api.util.invalidateTags(['Auth', 'Profile', 'Events', 'Agenda', 'Attendees', 'Messages', 'Sponsors', 'MeetingRequests', 'Contacts']));
          
          setTimeout(() => {
            try {
              dispatch(api.util.resetApiState());
              console.log('✅ Logout complete - cache cleared');
            } catch (error) {
              // Ignore AbortSignal errors - they occur when resetApiState aborts active queries
              // This is expected behavior and doesn't affect functionality
              if (error?.message?.includes('AbortSignal') || error?.message?.includes('abort') || error?.name === 'TypeError') {
                // Silently ignore - this is expected when aborting active queries
                console.log('ℹ️ Cache cleared (active queries aborted)');
              } else {
                console.warn('⚠️ Error clearing cache:', error);
              }
            }
          }, 500); // Increased delay to 500ms for better stability
        }
      },
    }),

    // 13. Delegate Forgot Password
    delegateForgotPassword: builder.mutation({
      query: ({ email }) => ({
        url: API_ENDPOINTS.AUTH_DELEGATE_FORGOT_PASSWORD,
        method: 'POST',
        body: { email },
      }),
    }),

    // 14. Verify Forgot Password OTP
    verifyForgotPasswordOtp: builder.mutation({
      query: ({ email, otp, user_type = 'delegate' }) => ({
        url: API_ENDPOINTS.AUTH_VERIFY_FORGOT_PASSWORD_OTP,
        method: 'POST',
        body: { email, otp, user_type },
      }),
    }),

    // 15. Delegate Reset Password
    delegateResetPassword: builder.mutation({
      query: ({ email, otp, new_password, confirm_password, user_type = 'delegate' }) => ({
        url: API_ENDPOINTS.AUTH_DELEGATE_RESET_PASSWORD,
        method: 'POST',
        body: { email, otp, new_password, confirm_password, user_type },
      }),
    }),

    // ============ DELEGATE ENDPOINTS ============
    // 2. Delegate Events
    getDelegateEvents: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_EVENTS,
      providesTags: ['Events'],
    }),

    // 3. All Delegates
    getAllDelegates: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_ALL_DELEGATES,
      providesTags: ['Attendees'],
    }),

    // 4. Send Meeting Request (Delegate)
    sendDelegateMeetingRequest: builder.mutation({
      query: ({ sponsor_id, event_id, priority, date, time, message = '' }) => ({
        url: API_ENDPOINTS.DELEGATE_SEND_MEETING_REQUEST,
        method: 'POST',
        body: { sponsor_id, event_id, priority, date, time, message },
      }),
      invalidatesTags: ['MeetingRequests'],
    }),

    // 5. Review Meeting Request (Delegate)
    getDelegateMeetingRequests: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_REVIEW_MEETING_REQUESTS,
      providesTags: ['MeetingRequests'],
    }),

    // 6. Meeting Request Action (Delegate)
    delegateMeetingRequestAction: builder.mutation({
      query: ({ meeting_request_id, action }) => ({
        url: API_ENDPOINTS.DELEGATE_MEETING_REQUEST_ACTION,
        method: 'POST',
        body: { meeting_request_id, action }, // action: "accept" or "reject"
      }),
      invalidatesTags: ['MeetingRequests'],
    }),

    // 7. Agenda
    getAgenda: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return API_ENDPOINTS.AGENDA_BY_ID(eventId);
      },
      providesTags: ['Agenda'],
    }),

    // 8. Agenda Item
    getAgendaItem: builder.query({
      query: (agendaId) => {
        if (!agendaId) {
          return null;
        }
        return API_ENDPOINTS.AGENDA_ITEM_BY_ID(agendaId);
      },
      providesTags: (result, error, agendaId) => [{ type: 'Agenda', id: agendaId }],
    }),

    // 9. Delegate Attendees
    getDelegateAttendees: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_ATTENDEES,
      providesTags: ['Attendees'],
    }),

    // 10. View Itinerary (Delegate)
    getDelegateItinerary: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_VIEW_ITINERARY,
      providesTags: ['Agenda'],
    }),

    // 11. Delegate Profile
    getDelegateProfile: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_PROFILE,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Profile'],
      // Don't cache this query - always fetch fresh
      keepUnusedDataFor: 0,
    }),

    // 12. Delegate Profile Update
    updateDelegateProfile: builder.mutation({
      query: (profileData) => {
        // FormData for multipart/form-data
        const body = profileData instanceof FormData ? profileData : new FormData();
        if (!(profileData instanceof FormData)) {
          Object.keys(profileData).forEach((key) => {
            if (profileData[key] !== null && profileData[key] !== undefined) {
              body.append(key, profileData[key]);
            }
          });
        }
        return {
          url: API_ENDPOINTS.DELEGATE_PROFILE_UPDATE,
          method: 'POST',
          body,
          prepareHeaders: (headers) => {
            headers.delete('Content-Type');
            return headers;
          },
        };
      },
      invalidatesTags: ['Profile'],
    }),

    // 16. Send Message (Delegate)
    sendDelegateMessage: builder.mutation({
      query: ({ to_id, to_type, message }) => ({
        url: API_ENDPOINTS.DELEGATE_CHAT_SEND_MESSAGE,
        method: 'POST',
        body: { to_id, to_type, message },
      }),
      invalidatesTags: ['Messages'],
    }),

    // 17. Message List (Delegate)
    getDelegateMessages: builder.query({
      query: () => API_ENDPOINTS.DELEGATE_CHAT_MESSAGE_LIST,
      providesTags: ['Messages'],
    }),

    // ============ SPONSOR ENDPOINTS ============
    // 2. Sponsor Event by ID
    getSponsorEvent: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return API_ENDPOINTS.SPONSOR_EVENTS_BY_ID(eventId);
      },
      providesTags: ['Events'],
    }),

    // 3. Event Sponsor
    getEventSponsor: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return API_ENDPOINTS.SPONSOR_EVENT_SPONSOR(eventId);
      },
      providesTags: ['Sponsors'],
    }),

    // 4. Meeting Request from Delegate (Sponsor)
    getSponsorMeetingRequests: builder.query({
      query: () => API_ENDPOINTS.SPONSOR_MEETING_REQUEST_FROM_DELEGATE,
      providesTags: ['MeetingRequests'],
    }),

    // 5. Sponsor Services
    getSponsorServices: builder.query({
      query: (eventId) => ({
        url: API_ENDPOINTS.SPONSOR_SERVICES,
        params: { event_id: eventId },
      }),
      providesTags: ['Sponsors'],
    }),

    // 6. Sponsor All Attendees
    getSponsorAllAttendees: builder.query({
      query: () => API_ENDPOINTS.SPONSOR_ALL_ATTENDEES,
      providesTags: ['Attendees'],
    }),

    // 7. Send Meeting Request (Sponsor)
    sendSponsorMeetingRequest: builder.mutation({
      query: ({ delegate_id, event_id, priority, date, time, message = '' }) => ({
        url: API_ENDPOINTS.SPONSOR_SEND_MEETING_REQUEST,
        method: 'POST',
        body: { delegate_id, event_id, priority, date, time, message },
      }),
      invalidatesTags: ['MeetingRequests'],
    }),

    // 8. View Itinerary (Sponsor)
    getSponsorItinerary: builder.query({
      query: () => API_ENDPOINTS.SPONSOR_VIEW_ITINERARY,
      providesTags: ['Agenda'],
    }),

    // 9. Sponsor Profile
    getSponsorProfile: builder.query({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_PROFILE,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Profile'],
      // Don't cache this query - always fetch fresh
      keepUnusedDataFor: 0,
    }),

    // 10. Sponsor Profile Update
    updateSponsorProfile: builder.mutation({
      query: (profileData) => {
        // FormData for multipart/form-data
        const body = profileData instanceof FormData ? profileData : new FormData();
        if (!(profileData instanceof FormData)) {
          Object.keys(profileData).forEach((key) => {
            if (profileData[key] !== null && profileData[key] !== undefined) {
              body.append(key, profileData[key]);
            }
          });
        }
        return {
          url: API_ENDPOINTS.SPONSOR_PROFILE_UPDATE,
          method: 'POST',
          body,
          prepareHeaders: (headers) => {
            headers.delete('Content-Type');
            return headers;
          },
        };
      },
      invalidatesTags: ['Profile'],
    }),

    // 11. Send Message (Sponsor)
    sendSponsorMessage: builder.mutation({
      query: ({ to_id, to_type, message }) => ({
        url: API_ENDPOINTS.SPONSOR_CHAT_SEND_MESSAGE,
        method: 'POST',
        body: { to_id, to_type, message },
      }),
      invalidatesTags: ['Messages'],
    }),

    // 12. Message List (Sponsor)
    getSponsorMessages: builder.query({
      query: () => API_ENDPOINTS.SPONSOR_CHAT_MESSAGE_LIST,
      providesTags: ['Messages'],
    }),
  }),
});

// Export hooks for usage in components
export const {
  // Auth
  useDelegateLoginMutation,
  useSponsorLoginMutation,
  useDelegateLogoutMutation,
  useSponsorLogoutMutation,
  useRefreshTokenMutation,
  useDelegateForgotPasswordMutation,
  useVerifyForgotPasswordOtpMutation,
  useDelegateResetPasswordMutation,

  // Delegate Endpoints
  useGetDelegateEventsQuery,
  useGetAllDelegatesQuery,
  useSendDelegateMeetingRequestMutation,
  useGetDelegateMeetingRequestsQuery,
  useDelegateMeetingRequestActionMutation,
  useGetAgendaQuery,
  useGetAgendaItemQuery,
  useGetDelegateAttendeesQuery,
  useGetDelegateItineraryQuery,
  useGetDelegateProfileQuery,
  useUpdateDelegateProfileMutation,
  useSendDelegateMessageMutation,
  useGetDelegateMessagesQuery,

  // Sponsor Endpoints
  useGetSponsorEventQuery,
  useGetEventSponsorQuery,
  useGetSponsorMeetingRequestsQuery,
  useGetSponsorServicesQuery,
  useGetSponsorAllAttendeesQuery,
  useSendSponsorMeetingRequestMutation,
  useGetSponsorItineraryQuery,
  useGetSponsorProfileQuery,
  useUpdateSponsorProfileMutation,
  useSendSponsorMessageMutation,
  useGetSponsorMessagesQuery,
} = api;
