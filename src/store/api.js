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
        // Only log in development for performance
        if (__DEV__) {
          console.log('✅ Token added to request headers');
        }
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

// Base64 decode utility for React Native
const base64Decode = (str) => {
  try {
    // React Native compatible base64 decode
    if (typeof atob !== 'undefined') {
      return atob(str);
    }
    // Fallback for React Native (using Buffer if available)
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('binary');
    }
    // Manual base64 decode as last resort
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str.charAt(i));
      const enc2 = chars.indexOf(str.charAt(i + 1));
      const enc3 = chars.indexOf(str.charAt(i + 2));
      const enc4 = chars.indexOf(str.charAt(i + 3));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return output;
  } catch (error) {
    console.error('❌ Error in base64 decode:', error);
    return null;
  }
};

// JWT decode utility (simple base64 decode - no signature verification needed)
const decodeJWT = (token) => {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode payload (base64url)
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = base64Decode(base64);
    if (!decoded) return null;
    
    // Convert to JSON
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('❌ Error decoding JWT:', error);
    return null;
  }
};

// Token expiry utility
// Tokens are valid for 30 days, auto logout 2 hours before expiry
const AUTO_LOGOUT_HOURS_BEFORE_EXPIRY = 2;
const AUTO_LOGOUT_SECONDS = AUTO_LOGOUT_HOURS_BEFORE_EXPIRY * 60 * 60; // 2 hours in seconds

const checkTokenExpiry = async () => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return true; // No token, assume expired
    
    // Decode JWT to get expiry time
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp) {
      console.warn('⚠️ Could not decode token or missing exp field');
      return true; // Assume expired for security
    }
    
    // Get expiry time from JWT (in seconds)
    const tokenExpiry = decoded.exp;
    // Calculate auto logout time (2 hours before expiry)
    const autoLogoutTime = tokenExpiry - AUTO_LOGOUT_SECONDS;
    // Current time in seconds
    const now = Math.floor(Date.now() / 1000);
    
    if (now >= autoLogoutTime) {
      console.log('⏰ Token expired (2 hours before JWT expiry) - auto logout');
      // Clear all auth data
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('auth_user');
      await AsyncStorage.removeItem('token_expires_at');
      await AsyncStorage.removeItem('token_created_at');
      return true; // Token expired
    }
    return false; // Token still valid
  } catch (error) {
    console.error('❌ Error checking token expiry:', error);
    return true; // On error, assume expired for security
  }
};

// Enhanced base query with error handling
// Note: Tokens are valid for 30 days, auto logout 2 hours before expiry
const baseQueryWithErrorHandling = async (args, api, extraOptions) => {
  // Check token expiry before making request (for protected endpoints)
  const isAuthEndpoint = args.url?.includes('/auth/') || args.url?.includes('/login') || args.url?.includes('/logout');
  if (!isAuthEndpoint) {
    const isExpired = await checkTokenExpiry();
    if (isExpired) {
      return {
        error: {
          status: 'AUTH_REQUIRED',
          data: { message: 'Session expired. Please login again.' },
          message: 'Session expired. Please login again.',
        },
      };
    }
  }
  
  // Check token before making request
  const tokenBeforeRequest = await AsyncStorage.getItem('auth_token');
  // Only log in development for performance
  if (__DEV__) {
    console.log('🌐 API Request:', args.url || args, 'Token present:', tokenBeforeRequest ? 'Yes' : 'No');
  }
  
  // For authenticated endpoints (not login/logout), ensure token is available
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

  // Handle errors with retry logic for network errors
  if (result.error) {
    const errorStatus = result.error.status;
    const isFetchError = errorStatus === 'FETCH_ERROR';
    
    // For FETCH_ERROR, retry with exponential backoff (might be timing/network issue)
    if (isFetchError && !isAuthEndpoint) {
      const maxRetries = 2;
      let retryCount = 0;
      let initialError = result.error;
      
      // Log initial network error at warn level (will retry)
      console.warn(`⚠️ Network error on ${args.url || args} - retrying (${retryCount + 1}/${maxRetries})...`);
      
      while (retryCount < maxRetries && result.error && result.error.status === 'FETCH_ERROR') {
        const delay = 500 * Math.pow(2, retryCount); // 500ms, 1000ms
        await new Promise(resolve => setTimeout(resolve, delay));
        result = await baseQuery(args, api, extraOptions);
        retryCount++;
        
        if (!result.error) {
          // Only log in development for performance
          if (__DEV__) {
            console.log(`✅ Request succeeded after ${retryCount} retry${retryCount > 1 ? 'ies' : ''}`);
          }
          break;
        } else if (retryCount < maxRetries) {
          console.warn(`⚠️ Retry ${retryCount} failed - retrying (${retryCount + 1}/${maxRetries})...`);
        }
      }
      
      // Only log error if all retries failed
      if (result.error && result.error.status === 'FETCH_ERROR') {
        console.error('❌ API Error (all retries failed):', {
          url: args.url || args,
          status: errorStatus,
          message: initialError.data?.message || initialError.message || 'Network error - check connectivity',
          data: initialError.data,
        });
        console.error('❌ Network issue persists. Please check your connection.');
      }
    } else {
      // For auth endpoints with network errors, provide helpful message
      if (isFetchError && isAuthEndpoint) {
        console.error('❌ Network Error (Auth Endpoint):', {
          url: args.url || args,
          status: errorStatus,
          message: 'Network request failed. Please check your internet connection and try again.',
          data: result.error.data,
        });
      } else {
        // 404 (Not Found) is a valid business logic response - log as warning
        // It means resource doesn't exist or user doesn't have permission
        if (errorStatus === 404) {
          console.warn('⚠️ Resource Not Found (404):', {
            url: args.url || args,
            status: errorStatus,
            message: result.error.data?.message || result.error.message || 'Resource not found',
            data: result.error.data,
          });
        } else {
          // For other non-network errors (500, etc.), log as error
          console.error('❌ API Error:', {
            url: args.url || args,
            status: errorStatus,
            message: result.error.data?.message || result.error.message || 'Unknown error',
            data: result.error.data,
          });
        }
      }
    }
  }

  // If unauthorized (401), token is invalid/expired - redirect to login
  // Tokens are valid for 30 days, so no refresh needed
  // For 403 (Forbidden), don't refresh - it's a permission issue, not token expiry
  // IMPORTANT: Don't convert 401 to AUTH_REQUIRED for login/auth endpoints
  // For login endpoints, 401 means wrong credentials - return actual error message
  if (result.error && result.error.status === 401 && !isAuthEndpoint) {
    console.log('🚫 Unauthorized (401) - Token invalid/expired. Clearing auth and redirecting to login...');
    
    // Clear all auth data
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('auth_user');
      await AsyncStorage.removeItem('token_expires_at');
      await AsyncStorage.removeItem('token_created_at');
    } catch (e) {
      console.error('❌ Error clearing auth data:', e);
    }
    
    // Return error that will trigger redirect in component
    return {
      error: {
        status: 'AUTH_REQUIRED',
        data: { message: 'Authentication required. Please login again.' },
        message: 'Authentication required. Please login again.',
      },
    };
  } else if (result.error && result.error.status === 403) {
    // 403 Forbidden - permission issue, not token expiry
    // Don't try to refresh, just return the error
    console.warn('⚠️ 403 Forbidden - Permission denied. Not attempting token refresh.');
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
          
          // Try multiple possible field names for token
          const token = data?.token || data?.data?.token || data?.access_token || data?.accessToken;
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            
            // Only log in development for performance
            if (__DEV__) {
              const storedToken = await AsyncStorage.getItem('auth_token');
              console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
              
              // Decode JWT to show expiry info
              const decoded = decodeJWT(token);
              if (decoded && decoded.exp) {
                const expiryDate = new Date(decoded.exp * 1000);
                const autoLogoutDate = new Date((decoded.exp - AUTO_LOGOUT_SECONDS) * 1000);
                console.log('📅 Token expires at:', expiryDate.toLocaleString());
                console.log('⏰ Auto logout at:', autoLogoutDate.toLocaleString(), '(2 hours before expiry)');
              }
            }
          } else if (__DEV__) {
            console.error('❌ No token received in login response');
          }
          
          // Store user data including qr_image
          const userData = data.data || data;
          await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
          
          // Reset entire RTK Query cache to ensure fresh data for new user
          // Add delay to ensure token is fully stored and network is ready
          setTimeout(() => {
            dispatch(api.util.resetApiState());
          }, 500); // Increased delay to 500ms for better network stability
        } catch (error) {
          // Only log storage errors if the request succeeded but storage failed
          // Network errors and authentication errors are handled by baseQueryWithErrorHandling
          const errorStatus = error?.status || error?.error?.status;
          const isNetworkError = errorStatus === 'FETCH_ERROR' || 
                                error?.message?.includes('FETCH_ERROR') ||
                                error?.message?.includes('Network request failed');
          
          // Authentication errors (401, 403) are expected and already logged by baseQueryWithErrorHandling
          const isAuthError = errorStatus === 401 || errorStatus === 403 || 
                             errorStatus === 'AUTH_REQUIRED' || 
                             error?.error?.status === 401 || 
                             error?.error?.status === 403;
          
          if (isNetworkError || isAuthError) {
            // Network or authentication error - already logged by baseQueryWithErrorHandling, don't duplicate
            // These are expected errors (network unavailable, wrong credentials, etc.)
            return;
          }
          
          // Actual storage or processing error (unexpected errors)
          console.error('❌ Login token storage failed:', {
            error: error?.error || error,
            message: error?.error?.message || error?.message || 'Unknown error',
            status: errorStatus,
          });
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
          
          // Try multiple possible field names for token
          const token = data?.token || data?.data?.token || data?.access_token || data?.accessToken;
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            
            // Only log in development for performance
            if (__DEV__) {
              const storedToken = await AsyncStorage.getItem('auth_token');
              console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
              
              // Decode JWT to show expiry info
              const decoded = decodeJWT(token);
              if (decoded && decoded.exp) {
                const expiryDate = new Date(decoded.exp * 1000);
                const autoLogoutDate = new Date((decoded.exp - AUTO_LOGOUT_SECONDS) * 1000);
                console.log('📅 Token expires at:', expiryDate.toLocaleString());
                console.log('⏰ Auto logout at:', autoLogoutDate.toLocaleString(), '(2 hours before expiry)');
              }
            }
          } else if (__DEV__) {
            console.error('❌ No token received in login response');
          }
          
          // Store user data including qr_image
          const userData = data.data || data;
          await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
          
          // Reset entire RTK Query cache to ensure fresh data for new user
          // Add delay to ensure token is fully stored and network is ready
          setTimeout(() => {
            dispatch(api.util.resetApiState());
          }, 500); // Increased delay to 500ms for better network stability
        } catch (error) {
          // Only log storage errors if the request succeeded but storage failed
          // Network errors and authentication errors are handled by baseQueryWithErrorHandling
          const errorStatus = error?.status || error?.error?.status;
          const isNetworkError = errorStatus === 'FETCH_ERROR' || 
                                error?.message?.includes('FETCH_ERROR') ||
                                error?.message?.includes('Network request failed');
          
          // Authentication errors (401, 403) are expected and already logged by baseQueryWithErrorHandling
          const isAuthError = errorStatus === 401 || errorStatus === 403 || 
                             errorStatus === 'AUTH_REQUIRED' || 
                             error?.error?.status === 401 || 
                             error?.error?.status === 403;
          
          if (isNetworkError || isAuthError) {
            // Network or authentication error - already logged by baseQueryWithErrorHandling, don't duplicate
            // These are expected errors (network unavailable, wrong credentials, etc.)
            return;
          }
          
          // Actual storage or processing error (unexpected errors)
          console.error('❌ Login token storage failed:', {
            error: error?.error || error,
            message: error?.error?.message || error?.message || 'Unknown error',
            status: errorStatus,
          });
        }
      },
    }),

    // Refresh Token - DISABLED
    // Tokens are valid for 30 days, no refresh needed
    // Auto logout happens 2 hours before token expiry (28 days 22 hours after login)
    /*
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
          const newToken = data?.token || data?.data?.token;
          const expiresAt = data?.expires_at;
          
          if (newToken) {
            await AsyncStorage.setItem('auth_token', newToken);
            await AsyncStorage.setItem('refresh_token', newToken);
            console.log('✅ Token refreshed via mutation');
            
            if (expiresAt) {
              await AsyncStorage.setItem('token_expires_at', expiresAt);
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      },
    }),
    */

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
          await AsyncStorage.removeItem('token_created_at');
          
          // Clear entire RTK Query cache on logout
          // Use longer delay to allow active queries to complete/abort gracefully
          // Also invalidate all tags to prevent refetching
          dispatch(api.util.invalidateTags(['Auth', 'Profile', 'Events', 'Agenda', 'Attendees', 'Messages', 'Sponsors', 'MeetingRequests', 'Contacts']));
          
          setTimeout(() => {
            try {
              dispatch(api.util.resetApiState());
              // Only log in development for performance
              if (__DEV__) {
                console.log('✅ Logout complete - cache cleared');
              }
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
          await AsyncStorage.removeItem('token_created_at');
          
          // Clear entire RTK Query cache on logout
          // Use longer delay to allow active queries to complete/abort gracefully
          // Also invalidate all tags to prevent refetching
          dispatch(api.util.invalidateTags(['Auth', 'Profile', 'Events', 'Agenda', 'Attendees', 'Messages', 'Sponsors', 'MeetingRequests', 'Contacts']));
          
          setTimeout(() => {
            try {
              dispatch(api.util.resetApiState());
              // Only log in development for performance
              if (__DEV__) {
                console.log('✅ Logout complete - cache cleared');
              }
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

    // 15a. Sponsor Forgot Password
    sponsorForgotPassword: builder.mutation({
      query: ({ email }) => ({
        url: API_ENDPOINTS.AUTH_SPONSOR_FORGOT_PASSWORD,
        method: 'POST',
        body: { email },
      }),
    }),

    // 15b. Sponsor Reset Password
    sponsorResetPassword: builder.mutation({
      query: ({ email, otp, new_password, confirm_password }) => ({
        url: API_ENDPOINTS.AUTH_SPONSOR_RESET_PASSWORD,
        method: 'POST',
        body: { email, otp, new_password, confirm_password },
      }),
    }),

    // 16. Delegate Change Password
    delegateChangePassword: builder.mutation({
      query: ({ current_password, new_password, confirm_password }) => ({
        url: API_ENDPOINTS.AUTH_DELEGATE_CHANGE_PASSWORD,
        method: 'POST',
        body: { current_password, new_password, confirm_password },
      }),
      invalidatesTags: ['Profile'],
    }),

    // 17. Sponsor Change Password
    sponsorChangePassword: builder.mutation({
      query: ({ current_password, new_password, confirm_password }) => ({
        url: API_ENDPOINTS.AUTH_SPONSOR_CHANGE_PASSWORD,
        method: 'POST',
        body: { current_password, new_password, confirm_password },
      }),
      invalidatesTags: ['Profile'],
    }),

    // ============ DELEGATE ENDPOINTS ============
    // 2. Delegate Events
    getDelegateEvents: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_EVENTS,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Events'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 3. All Delegates
    getAllDelegates: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_ALL_DELEGATES,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Attendees'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
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
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_REVIEW_MEETING_REQUESTS,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['MeetingRequests'],
      // Poll every 10 seconds to get latest requests
      pollingInterval: 10000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
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
        return {
          url: API_ENDPOINTS.AGENDA_BY_ID(eventId),
          // Add timestamp to force fresh request (bypass cache)
          params: { _t: Date.now() },
        };
      },
      providesTags: ['Agenda'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 8. Agenda Item
    getAgendaItem: builder.query({
      query: (agendaId) => {
        if (!agendaId) {
          return null;
        }
        return {
          url: API_ENDPOINTS.AGENDA_ITEM_BY_ID(agendaId),
          // Add timestamp to force fresh request (bypass cache)
          params: { _t: Date.now() },
        };
      },
      providesTags: (result, error, agendaId) => [{ type: 'Agenda', id: agendaId }],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 9. Delegate Attendees
    getDelegateAttendees: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_ATTENDEES,
        params: { _t: Date.now() }, // Add timestamp to force fresh request
      }),
      providesTags: ['Attendees'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      refetchOnMountOrArgChange: true, // Force refetch on mount
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 10. View Itinerary (Delegate)
    getDelegateItinerary: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_VIEW_ITINERARY,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Agenda'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
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
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
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
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_CHAT_MESSAGE_LIST,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Messages'],
      // Poll every 10 seconds to get latest messages
      pollingInterval: 10000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 18. Get Contacts (Delegate)
    getDelegateContacts: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_CONTACTS,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Contacts'],
      // Poll every 10 seconds to get latest contacts
      pollingInterval: 10000,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
    }),

    // 19. Save Contact (Delegate)
    saveDelegateContact: builder.mutation({
      query: (contactData) => ({
        url: API_ENDPOINTS.DELEGATE_SAVE_CONTACT,
        method: 'POST',
        body: contactData,
      }),
      invalidatesTags: ['Contacts'],
    }),

    // 20. Delete Contact (Delegate)
    deleteDelegateContact: builder.mutation({
      query: ({ contact_id }) => ({
        url: API_ENDPOINTS.DELEGATE_DELETE_CONTACT,
        method: 'POST',
        body: { contact_id },
      }),
      invalidatesTags: ['Contacts'],
    }),

    // 20. Get Messages with specific user (Delegate)
    getDelegateChatMessages: builder.query({
      query: (toId) => {
        if (!toId) {
          return null;
        }
        return {
          url: API_ENDPOINTS.DELEGATE_CHAT_MESSAGES,
          params: { 
            to_id: toId,
            // Add timestamp to force fresh request (bypass cache)
            _t: Date.now(),
          },
        };
      },
      providesTags: ['Messages'],
      // Poll every 5 seconds for chat messages (more frequent for real-time feel)
      pollingInterval: 10000, // Increased to 10s for better performance
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // ============ SPONSOR ENDPOINTS ============
    // 2. Sponsor Events (all events)
    getSponsorEvents: builder.query({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_EVENTS,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Events'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 3. Sponsor Event by ID
    getSponsorEvent: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return {
          url: `${API_ENDPOINTS.SPONSOR_EVENTS}/${eventId}`,
          // Add timestamp to force fresh request (bypass cache)
          params: { _t: Date.now() },
        };
      },
      providesTags: ['Events'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 4. Event Sponsor
    getEventSponsor: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return {
          url: API_ENDPOINTS.SPONSOR_EVENT_SPONSOR(eventId),
          // Add timestamp to force fresh request (bypass cache)
          params: { _t: Date.now() },
        };
      },
      providesTags: ['Sponsors'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 4. Meeting Request from Delegate (Sponsor)
    getSponsorMeetingRequests: builder.query({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_MEETING_REQUEST_FROM_DELEGATE,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['MeetingRequests'],
      // Poll every 10 seconds to get latest requests
      pollingInterval: 10000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 4a. Sponsor Meeting Request Action
    sponsorMeetingRequestAction: builder.mutation({
      query: ({ meeting_request_id, action }) => ({
        url: API_ENDPOINTS.SPONSOR_MEETING_REQUEST_ACTION,
        method: 'POST',
        body: { meeting_request_id, action }, // action: "accept" or "reject"
      }),
      invalidatesTags: ['MeetingRequests'],
    }),

    // 5. Sponsor Services
    getSponsorServices: builder.query({
      query: (eventId) => ({
        url: API_ENDPOINTS.SPONSOR_SERVICES,
        params: { 
          event_id: eventId,
          // Add timestamp to force fresh request (bypass cache)
          _t: Date.now(),
        },
      }),
      providesTags: ['Sponsors'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 6. Sponsor All Attendees
    getSponsorAllAttendees: builder.query({
      query: (selectedServices = []) => {
        const params = { _t: Date.now() }; // Add timestamp to force fresh request
        // Add services as query parameter if provided
        if (selectedServices && selectedServices.length > 0) {
          // Handle both array and comma-separated string
          if (Array.isArray(selectedServices)) {
            // Use comma-separated format for services
            params.services = selectedServices.join(',');
          } else {
            params.services = selectedServices;
          }
        }
        return {
          url: API_ENDPOINTS.SPONSOR_ALL_ATTENDEES,
          params,
        };
      },
      providesTags: ['Attendees'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      refetchOnMountOrArgChange: true, // Force refetch on mount
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
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
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_VIEW_ITINERARY,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Agenda'],
      // Poll every 15 seconds to get latest data (optimized for performance)
      pollingInterval: 15000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
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
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
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
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_CHAT_MESSAGE_LIST,
        // Add timestamp to force fresh request (bypass cache)
        params: { _t: Date.now() },
      }),
      providesTags: ['Messages'],
      // Poll every 10 seconds to get latest messages
      pollingInterval: 10000,
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 13. Get Messages with specific user (Sponsor)
    getSponsorChatMessages: builder.query({
      query: (toId) => {
        if (!toId) {
          return null;
        }
        return {
          url: API_ENDPOINTS.SPONSOR_CHAT_MESSAGES,
          params: { 
            to_id: toId,
            // Add timestamp to force fresh request (bypass cache)
            _t: Date.now(),
          },
        };
      },
      providesTags: ['Messages'],
      // Poll every 5 seconds for chat messages (more frequent for real-time feel)
      pollingInterval: 10000, // Increased to 10s for better performance
      // Refetch when component mounts or screen comes into focus
      refetchOnMountOrArgChange: true,
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 14. Delete Contact (Sponsor)
    deleteSponsorContact: builder.mutation({
      query: ({ contact_id }) => ({
        url: API_ENDPOINTS.SPONSOR_DELETE_CONTACT,
        method: 'POST',
        body: { contact_id },
      }),
      invalidatesTags: ['Contacts'],
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
  // useRefreshTokenMutation, // DISABLED - Tokens valid for 30 days, no refresh needed
  useDelegateForgotPasswordMutation,
  useVerifyForgotPasswordOtpMutation,
  useDelegateResetPasswordMutation,
  useDelegateChangePasswordMutation,
  useSponsorForgotPasswordMutation,
  useSponsorResetPasswordMutation,
  useSponsorChangePasswordMutation,

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
  useGetDelegateContactsQuery,
  useSaveDelegateContactMutation,
  useDeleteDelegateContactMutation,
  useSendDelegateMessageMutation,
  useGetDelegateMessagesQuery,
  useGetDelegateChatMessagesQuery,

  // Sponsor Endpoints
  useGetSponsorEventsQuery,
  useGetSponsorEventQuery,
  useGetEventSponsorQuery,
  useGetSponsorMeetingRequestsQuery,
  useSponsorMeetingRequestActionMutation,
  useGetSponsorServicesQuery,
  useGetSponsorAllAttendeesQuery,
  useSendSponsorMeetingRequestMutation,
  useGetSponsorItineraryQuery,
  useGetSponsorProfileQuery,
  useUpdateSponsorProfileMutation,
  useSendSponsorMessageMutation,
  useGetSponsorMessagesQuery,
  useGetSponsorChatMessagesQuery,
  useDeleteSponsorContactMutation,
} = api;
