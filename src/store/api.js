import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { normalizeEventIdForApi } from '../utils/parseEventId';

// Base query with token injection
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
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
  const isContactEndpoint = args.url?.includes('contact/submit');
  const isPublicEndpoint = isAuthEndpoint || isContactEndpoint;
  if (!isPublicEndpoint) {
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
  
  // Check token before making request (contact form works without login)
  const tokenBeforeRequest = await AsyncStorage.getItem('auth_token');
  console.log('🌐 API Request:', args.url || args, 'Token present:', tokenBeforeRequest ? 'Yes' : 'No');
  
  // For authenticated endpoints (not login/logout/contact), ensure token is available
  if (!isPublicEndpoint && !tokenBeforeRequest) {
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

  // Some backends return HTTP 4xx/5xx on the first meeting-request call but JSON still says success.
  // fetchBaseQuery treats any non-2xx as error → unwrap() throws even when the request actually worked.
  // Normalize to success when the body clearly indicates the meeting was created.
  if (result.error && typeof args.url === 'string') {
    const url = args.url;
    const isSendMeetingRequest =
      url.includes('send-meeting-request') ||
      url === API_ENDPOINTS.DELEGATE_SEND_MEETING_REQUEST ||
      url === API_ENDPOINTS.SPONSOR_SEND_MEETING_REQUEST;
    if (isSendMeetingRequest) {
      const d = result.error.data;
      const bodyIndicatesSuccess =
        d &&
        typeof d === 'object' &&
        (d.success === true ||
          d.success === 1 ||
          String(d.success).toLowerCase() === 'true' ||
          d.data?.success === true ||
          d.data?.success === 1);
      if (bodyIndicatesSuccess) {
        console.warn(
          '⚠️ Meeting request: HTTP status was',
          result.error.status,
          'but response body indicates success. Treating as success.'
        );
        return { data: d };
      }
    }
  }

  // Handle errors with retry logic for network errors
  if (result.error) {
    const errorStatus = result.error.status;
    const isFetchError = errorStatus === 'FETCH_ERROR';
    const isPushRegister = typeof args.url === 'string' && args.url.includes('push/register-token');
    const isPresenceEndpoint =
      typeof args.url === 'string' &&
      (args.url === API_ENDPOINTS.PRESENCE_PING ||
        args.url === API_ENDPOINTS.PRESENCE_ONLINE ||
        args.url.includes('/presence/ping') ||
        args.url.includes('/presence/online'));

    // Push register is optional (backend may not have endpoint deployed yet) - don't log as error
    if (isPushRegister && (errorStatus === 404 || errorStatus === 'PARSING_ERROR')) {
      console.warn('⚠️ Push registration skipped (endpoint not available or returned 404). Notifications may not work until backend is updated.');
      return result;
    }

    // Presence heartbeat/online APIs are best-effort.
    // If network is flaky, don't spam scary errors after login.
    if (isPresenceEndpoint && (isFetchError || errorStatus === 404 || errorStatus === 'PARSING_ERROR')) {
      console.warn('⚠️ Presence sync skipped (temporary network/backend issue).');
      return result;
    }

    // PARSING_ERROR on meeting request often means backend returned non-JSON (e.g. PHP warning) - let caller handle
    const isMeetingRequest = typeof args.url === 'string' && (args.url.includes('send-meeting-request'));
    if (isMeetingRequest && errorStatus === 'PARSING_ERROR') {
      console.warn('⚠️ Send meeting request: response was not valid JSON. Request may still have succeeded.');
      return result;
    }
    // PARSING_ERROR on chat send-message: backend often saved message but returned non-JSON - don't log as error
    const isChatSendMessage = typeof args.url === 'string' && (args.url.includes('chat/send-message'));
    if (isChatSendMessage && errorStatus === 'PARSING_ERROR') {
      console.warn('⚠️ Send message: response was not valid JSON. Message may have been sent.');
      return result;
    }

    // PARSING_ERROR on contacts: backend sometimes returns empty/whitespace or non-JSON.
    // Treat as an empty contacts list so the Contacts screen can still render.
    const isContactsEndpoint =
      typeof args.url === 'string' &&
      (args.url === API_ENDPOINTS.DELEGATE_CONTACTS ||
        args.url === API_ENDPOINTS.DELEGATE_SAVE_CONTACT ||
        args.url === API_ENDPOINTS.SPONSOR_CONTACTS ||
        args.url === API_ENDPOINTS.SPONSOR_SAVE_CONTACT ||
        args.url.includes('/delegate/contacts') ||
        args.url.includes('/delegate/save-contact') ||
        args.url.includes('/sponsor/contacts') ||
        args.url.includes('/sponsor/save-contact'));
    if (isContactsEndpoint && errorStatus === 'PARSING_ERROR') {
      const raw = result?.error?.data;
      const text = typeof raw === 'string' ? raw : '';
      if (!text || text.trim().length === 0) {
        console.warn('⚠️ Contacts: response was empty/non-JSON. Treating as empty list.');
        return { data: { success: true, data: [] } };
      }
      // If it's non-empty but not JSON, still avoid hard-failing the screen.
      console.warn('⚠️ Contacts: response was not valid JSON. Treating as empty list.');
      return { data: { success: true, data: [] } };
    }
    // 409 DUPLICATE_MEETING is a business rule, not a bug - show backend message in UI, don't log as error
    if (isMeetingRequest && errorStatus === 409) {
      console.warn('Meeting request: ', result.error.data?.message || 'Duplicate or conflict.');
      return result;
    }
    
    // For FETCH_ERROR, retry with exponential backoff (might be timing/network issue)
    if (isFetchError && !isAuthEndpoint && !isPresenceEndpoint) {
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
          console.log(`✅ Request succeeded after ${retryCount} retry${retryCount > 1 ? 'ies' : ''}`);
          break;
        } else if (retryCount < maxRetries) {
          console.warn(`⚠️ Retry ${retryCount} failed - retrying (${retryCount + 1}/${maxRetries})...`);
        }
      }
      
      // Only log error if all retries failed
      if (result.error && result.error.status === 'FETCH_ERROR') {
        console.warn('⚠️ API network warning (all retries failed):', {
          url: args.url || args,
          status: errorStatus,
          message: initialError.data?.message || initialError.message || 'Network error - check connectivity',
          data: initialError.data,
        });
        console.warn('⚠️ Network issue persists. Please check your connection.');
      }
    } else {
      // For non-network errors, log immediately. Keep FETCH_ERROR as warning to avoid red error overlay.
      const logPayload = {
        url: args.url || args,
        status: errorStatus,
        message: result.error.data?.message || result.error.message || 'Unknown error',
        data: result.error.data,
      };
      if (isFetchError) {
        console.warn('⚠️ API network warning:', logPayload);
      } else {
        console.error('❌ API Error:', logPayload);
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
    'MeetingRequestOutcomes',
    'Profile',
    'Contacts',
    'NotificationInbox',
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
          
          console.log('🔐 Delegate Login - Token received:', token ? 'Yes' : 'No');
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            const storedToken = await AsyncStorage.getItem('auth_token');
            console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
            
            // Decode JWT to show expiry info
            const decoded = decodeJWT(token);
            if (decoded && decoded.exp) {
              const expiryDate = new Date(decoded.exp * 1000);
              const autoLogoutDate = new Date((decoded.exp - AUTO_LOGOUT_SECONDS) * 1000);
              console.log('📅 Token expires at:', expiryDate.toLocaleString());
              console.log('⏰ Auto logout at:', autoLogoutDate.toLocaleString(), '(2 hours before expiry)');
            } else {
              console.log('📅 Token valid for 30 days (auto logout 2 hours before expiry)');
            }
          } else {
            console.error('❌ No token received in login response');
          }
          
          // Store user data including qr_image
          const userData = data.data || data;
          console.log('🔐 Delegate Login - User data:', JSON.stringify(userData, null, 2));
          console.log('🔐 Delegate Login - QR Image:', userData?.qr_image || 'Not found');
          await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
          
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
          
          console.log('🔐 Sponsor Login - Token received:', token ? 'Yes' : 'No');
          
          if (token) {
            await AsyncStorage.setItem('auth_token', token);
            const storedToken = await AsyncStorage.getItem('auth_token');
            console.log('✅ Token stored successfully:', storedToken ? 'Yes' : 'No');
            
            // Decode JWT to show expiry info
            const decoded = decodeJWT(token);
            if (decoded && decoded.exp) {
              const expiryDate = new Date(decoded.exp * 1000);
              const autoLogoutDate = new Date((decoded.exp - AUTO_LOGOUT_SECONDS) * 1000);
              console.log('📅 Token expires at:', expiryDate.toLocaleString());
              console.log('⏰ Auto logout at:', autoLogoutDate.toLocaleString(), '(2 hours before expiry)');
            } else {
              console.log('📅 Token valid for 30 days (auto logout 2 hours before expiry)');
            }
          } else {
            console.error('❌ No token received in login response');
          }
          
          // Store user data including qr_image
          const userData = data.data || data;
          console.log('🔐 Sponsor Login - User data:', JSON.stringify(userData, null, 2));
          console.log('🔐 Sponsor Login - QR Image:', userData?.qr_image || 'Not found');
          await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
          
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
          await AsyncStorage.removeItem('token_created_at');
          
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
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
    }),

    /** Future Summits: events in same category as user’s `event_id` (delegate or sponsor token). */
    getUpcomingEvents: builder.query({
      query: (eventId) => {
        const n = normalizeEventIdForApi(eventId);
        if (n == null) return null;
        return {
          url: API_ENDPOINTS.UPCOMING_EVENTS,
          params: { event_id: n, _t: Date.now() },
        };
      },
      providesTags: ['Events'],
      refetchOnMountOrArgChange: true,
    }),

    /** Dashboard horizontal sponsor logos (`sponsor_logo` table) */
    getDelegateEventSponsorLogos: builder.query({
      query: (eventId) => {
        const n = normalizeEventIdForApi(eventId);
        if (n == null) return null;
        return {
          url: API_ENDPOINTS.DELEGATE_EVENT_SPONSOR_LOGOS,
          params: { event_id: n, _t: Date.now() },
        };
      },
      providesTags: ['Events'],
      refetchOnMountOrArgChange: true,
    }),

    /** Raffle Giveaway: resolve booth from scanned QR (POST body: event_id, raw | booth_id | booth_no) */
    boothRaffleBoothDetails: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.BOOTH_RAFFLE_BOOTH_DETAILS,
        method: 'POST',
        body,
      }),
    }),

    boothRaffleSubmit: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.BOOTH_RAFFLE_SUBMIT,
        method: 'POST',
        body,
      }),
    }),

    // 3. All Delegates (optional: event_id, services[] — server filters by products_services)
    getAllDelegates: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const a = arg && typeof arg === 'object' ? arg : {};
        if (a.event_id != null && a.event_id !== '') {
          const n = normalizeEventIdForApi(a.event_id);
          if (n != null) params.event_id = n;
        }
        if (Array.isArray(a.services) && a.services.length > 0) {
          params.services = a.services.join(',');
        }
        return {
          url: API_ENDPOINTS.DELEGATE_ALL_DELEGATES,
          params,
        };
      },
      providesTags: ['Attendees'],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
    }),

    // 3b. Delegate: event category services (for directory filter UI)
    getDelegateEventServices: builder.query({
      query: (eventId) => {
        const n = normalizeEventIdForApi(eventId);
        if (n == null) return null;
        return {
          url: API_ENDPOINTS.DELEGATE_EVENT_SERVICES,
          params: { event_id: n, _t: Date.now() },
        };
      },
      providesTags: ['Attendees', 'Sponsors'],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
    }),

    // 4. Send Meeting Request (Delegate)
    sendDelegateMeetingRequest: builder.mutation({
      query: ({
        sponsor_id,
        event_id,
        priority,
        meeting_date,
        meeting_time_from,
        meeting_time_to,
        meeting_location_option_id,
        meeting_location_other = '',
        message = '',
      }) => ({
        url: API_ENDPOINTS.DELEGATE_SEND_MEETING_REQUEST,
        method: 'POST',
        body: {
          sponsor_id,
          event_id,
          priority,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          meeting_location_option_id,
          meeting_location_other,
          message,
        },
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'Attendees', 'Sponsors'],
    }),

    // 4b. Send Meeting Request (Delegate -> Delegate)
    sendDelegateMeetingRequestToDelegate: builder.mutation({
      query: ({
        delegate_id,
        event_id,
        priority,
        meeting_date,
        meeting_time_from,
        meeting_time_to,
        meeting_location_option_id,
        meeting_location_other = '',
        message = '',
      }) => ({
        url: API_ENDPOINTS.DELEGATE_SEND_MEETING_REQUEST_TO_DELEGATE,
        method: 'POST',
        body: {
          delegate_id,
          event_id,
          priority,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          meeting_location_option_id,
          meeting_location_other,
          message,
        },
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'Attendees', 'Sponsors'],
    }),

    // 4a. Delegate Meeting Times (supports event_id+date OR date_from+date_to+target_sponsor_id)
    getDelegateMeetingTimes: builder.query({
      query: (args = {}) => {
        const raw = Number(args?.event_id);
        const event_id = (Number.isFinite(raw) && raw > 0) ? raw : 27;
        const params = { event_id, _t: Date.now() };
        if (args?.date != null) params.date = args.date;

        // Forward target id for slot filtering (works with both single-date and date-range APIs)
        if (args?.target_sponsor_id != null) params.target_sponsor_id = args.target_sponsor_id;
        if (args?.target_delegate_id != null) params.target_delegate_id = args.target_delegate_id;

        if (args?.date_from != null && args?.date_to != null) {
          params.date_from = args.date_from;
          params.date_to = args.date_to;
        }
        return { url: API_ENDPOINTS.DELEGATE_MEETING_TIMES, params };
      },
    }),

    // 4c. Delegate Meeting Location Options
    getDelegateMeetingLocations: builder.query({
      query: () => ({
        url: API_ENDPOINTS.DELEGATE_MEETING_LOCATIONS,
        params: { _t: Date.now() },
      }),
      keepUnusedDataFor: 0,
      refetchOnMountOrArgChange: true,
    }),

    // 5. Review Meeting Request (Delegate) - inbox: sponsors who requested delegate
    getDelegateMeetingRequests: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = normalizeEventIdForApi(raw);
          if (n != null) params.event_id = n;
        }
        return {
          url: API_ENDPOINTS.DELEGATE_REVIEW_MEETING_REQUESTS,
          params,
        };
      },
      providesTags: ['MeetingRequests'],
      // Force refetch on mount to avoid showing stale meeting requests
      refetchOnMountOrArgChange: true,
      // Don't keep old data around when screen unmounts
      keepUnusedDataFor: 0,
    }),

    // 6. Meeting Request Action (Delegate)
    delegateMeetingRequestAction: builder.mutation({
      query: ({ meeting_request_id, action }) => ({
        url: API_ENDPOINTS.DELEGATE_MEETING_REQUEST_ACTION,
        method: 'POST',
        body: { meeting_request_id, action }, // action: "accept" or "reject"
        // Backend may return empty/non-JSON body for 2xx responses (common for action endpoints).
        // Prevent PARSING_ERROR from bubbling up to the UI.
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'MeetingRequestOutcomes', 'Attendees', 'Sponsors'],
    }),

    // 5b. Delegate: outcomes of sent requests (sponsor accepted/declined) - for "Accepted"/"Declined" on Event Sponsors
    getDelegateMeetingRequestOutcomes: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = Number(raw);
          if (Number.isFinite(n) && n > 0) params.event_id = n;
        }
        return {
          url: API_ENDPOINTS.DELEGATE_MEETING_REQUEST_ACCEPTED_BY_SPONSOR,
          params,
        };
      },
      providesTags: ['MeetingRequestOutcomes'],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
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
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
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

    // 8b. Agenda: session check-in ("I'm in this session")
    checkInAgendaSession: builder.mutation({
      query: ({ agenda_id }) => ({
        url: API_ENDPOINTS.AGENDA_CHECK_IN,
        method: 'POST',
        body: { agenda_id },
        // Backend may return empty/non-JSON body for 2xx responses.
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: response.ok };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['Agenda'],
    }),

    // 8c. Agenda: check-in status for current user
    getAgendaCheckInStatus: builder.query({
      query: (agendaId) => {
        if (!agendaId) return null;
        return {
          url: API_ENDPOINTS.AGENDA_CHECK_IN_STATUS,
          params: { agenda_id: Number(agendaId), _t: Date.now() },
        };
      },
      providesTags: (result, error, agendaId) => [{ type: 'Agenda', id: `checkin-${agendaId}` }],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
    }),

    // 9. Delegate Attendees (sponsors for event — pass event_id so multi-event users get correct list)
    getDelegateAttendees: builder.query({
      query: (eventId) => {
        const params = { _t: Date.now() };
        const n = normalizeEventIdForApi(eventId);
        if (n != null) params.event_id = n;
        return {
          url: API_ENDPOINTS.DELEGATE_ATTENDEES,
          params,
        };
      },
      providesTags: ['Attendees'],
      refetchOnMountOrArgChange: true, // Force refetch on mount
      keepUnusedDataFor: 0,
    }),

    // 10. View Itinerary (Delegate)
    getDelegateItinerary: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = normalizeEventIdForApi(raw);
          if (n != null) params.event_id = n;
        }
        if (arg?.date) params.date = arg.date;
        return { url: API_ENDPOINTS.DELEGATE_VIEW_ITINERARY, params };
      },
      providesTags: ['Agenda'],
    }),

    delegateDeleteItineraryMeeting: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.DELEGATE_DELETE_ITINERARY_MEETING,
        method: 'POST',
        body,
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: response.ok };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['Agenda'],
    }),

    delegateModifyItineraryMeeting: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.DELEGATE_MODIFY_ITINERARY_MEETING,
        method: 'POST',
        body,
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: response.ok };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['Agenda'],
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

    // 16. Send Message (Delegate) — JSON body or FormData with `attachment` field
    sendDelegateMessage: builder.mutation({
      query: (arg) => {
        const isForm = typeof FormData !== 'undefined' && arg instanceof FormData;
        return {
          url: API_ENDPOINTS.DELEGATE_CHAT_SEND_MESSAGE,
          method: 'POST',
          body: isForm
            ? arg
            : { to_id: arg.to_id, to_type: arg.to_type, message: arg.message },
          prepareHeaders: (headers) => {
            if (isForm) headers.delete('Content-Type');
            return headers;
          },
          responseHandler: async (response) => {
            const text = await response.text();
            if (!text || !text.trim()) return { success: response.ok, message: 'Empty response' };
            try {
              return JSON.parse(text);
            } catch {
              return response.ok
                ? { success: true, message: 'Message may have been saved', data: {} }
                : { success: false, message: text };
            }
          },
        };
      },
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

    // 19a. Get Contacts (Sponsor)
    getSponsorContacts: builder.query({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_CONTACTS,
        params: { _t: Date.now() },
      }),
      providesTags: ['Contacts'],
      keepUnusedDataFor: 0,
      refetchOnMountOrArgChange: true,
    }),

    // 19b. Save Contact (Sponsor)
    saveSponsorContact: builder.mutation({
      query: (contactData) => ({
        url: API_ENDPOINTS.SPONSOR_SAVE_CONTACT,
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
      query: ({ toId, toType }) => {
        if (!toId || !toType) {
          return null;
        }
        return {
          url: API_ENDPOINTS.DELEGATE_CHAT_MESSAGES,
          params: {
            to_id: toId,
            to_type: toType,
            // Add timestamp to force fresh request (bypass cache)
            _t: Date.now(),
          },
        };
      },
      // Stable key: same numeric id can mean delegate vs sponsor — include toType
      serializeQueryArgs: ({ queryArgs }) => {
        const a = queryArgs;
        if (!a?.toId || !a?.toType) return 'delegateChat(skip)';
        return `delegateChat(${Number(a.toId)}:${String(a.toType).toLowerCase()})`;
      },
      providesTags: ['Messages'],
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
      // Force refetch on mount to get fresh data
      refetchOnMountOrArgChange: true,
    }),

    /** Dashboard horizontal sponsor logos (`sponsor_logo` table) */
    getSponsorEventSponsorLogos: builder.query({
      query: (eventId) => {
        const n = normalizeEventIdForApi(eventId);
        if (n == null) return null;
        return {
          url: API_ENDPOINTS.SPONSOR_EVENT_SPONSOR_LOGOS,
          params: { event_id: n, _t: Date.now() },
        };
      },
      providesTags: ['Events'],
      refetchOnMountOrArgChange: true,
    }),

    // 3. Sponsor Event by ID
    getSponsorEvent: builder.query({
      query: (eventId) => {
        if (!eventId) {
          return null;
        }
        return `${API_ENDPOINTS.SPONSOR_EVENTS}/${eventId}`;
      },
      providesTags: ['Events'],
    }),

    // 4. Event Sponsor
    getEventSponsor: builder.query({
      query: (eventId) => {
        const n = normalizeEventIdForApi(eventId);
        if (n == null) return null;
        return API_ENDPOINTS.SPONSOR_EVENT_SPONSOR(n);
      },
      providesTags: ['Sponsors'],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
    }),

    // 4. Meeting Request from Delegate (Sponsor) - inbox: delegates who requested sponsor
    getSponsorMeetingRequests: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = normalizeEventIdForApi(raw);
          if (n != null) params.event_id = n;
        }
        return {
          url: API_ENDPOINTS.SPONSOR_MEETING_REQUEST_FROM_DELEGATE,
          params,
        };
      },
      providesTags: ['MeetingRequests'],
      // Force refetch on mount to avoid showing stale meeting requests
      refetchOnMountOrArgChange: true,
      // Don't keep old data around when screen unmounts
      keepUnusedDataFor: 0,
    }),

    // 4a. Sponsor Meeting Request Action
    sponsorMeetingRequestAction: builder.mutation({
      query: ({ meeting_request_id, action }) => ({
        url: API_ENDPOINTS.SPONSOR_MEETING_REQUEST_ACTION,
        method: 'POST',
        body: { meeting_request_id, action }, // action: "accept" or "reject"
        // Backend may return empty/non-JSON body for 2xx responses (common for action endpoints).
        // Prevent PARSING_ERROR from bubbling up to the UI.
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'MeetingRequestOutcomes', 'Attendees', 'Sponsors'],
    }),

    // 4b. Sponsor: outcomes of sent requests (delegate accepted/declined) - for "Accepted"/"Declined" on Event Delegates
    getSponsorMeetingRequestOutcomes: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = Number(raw);
          if (Number.isFinite(n) && n > 0) params.event_id = n;
        }
        return {
          url: API_ENDPOINTS.SPONSOR_MEETING_REQUEST_ACCEPTED_BY_DELEGATE,
          params,
        };
      },
      providesTags: ['MeetingRequestOutcomes'],
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
    }),

    // 5. Sponsor Services
    getSponsorServices: builder.query({
      query: (eventId) => ({
        url: API_ENDPOINTS.SPONSOR_SERVICES,
        params: { event_id: eventId },
      }),
      providesTags: ['Sponsors'],
    }),

    // 6. Sponsor All Attendees (delegates for event — pass event_id for multi-event sponsors)
    getSponsorAllAttendees: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        let eventId = null;
        let selectedServices = [];
        if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
          eventId = arg.event_id ?? arg.eventId;
          const s = arg.services;
          if (Array.isArray(s)) selectedServices = s;
          else if (s != null && s !== '') selectedServices = [s];
        } else if (Array.isArray(arg)) {
          selectedServices = arg;
        }
        const n = normalizeEventIdForApi(eventId);
        if (n != null) params.event_id = n;
        if (selectedServices.length > 0) {
          params.services = Array.isArray(selectedServices)
            ? selectedServices.join(',')
            : String(selectedServices);
        }
        return {
          url: API_ENDPOINTS.SPONSOR_ALL_ATTENDEES,
          params,
        };
      },
      providesTags: ['Attendees'],
      refetchOnMountOrArgChange: true, // Force refetch on mount
    }),

    // 7. Send Meeting Request (Sponsor)
    sendSponsorMeetingRequest: builder.mutation({
      query: ({
        delegate_id,
        event_id,
        priority,
        meeting_date,
        meeting_time_from,
        meeting_time_to,
        meeting_location_option_id,
        meeting_location_other = '',
        message = '',
      }) => ({
        url: API_ENDPOINTS.SPONSOR_SEND_MEETING_REQUEST,
        method: 'POST',
        body: {
          delegate_id,
          event_id,
          priority,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          meeting_location_option_id,
          meeting_location_other,
          message,
        },
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'MeetingRequestOutcomes', 'Attendees', 'Sponsors'],
    }),

    // 7b. Send Meeting Request (Sponsor -> Sponsor)
    sendSponsorMeetingRequestToSponsor: builder.mutation({
      query: ({
        sponsor_id,
        event_id,
        priority,
        meeting_date,
        meeting_time_from,
        meeting_time_to,
        meeting_location_option_id,
        meeting_location_other = '',
        message = '',
      }) => ({
        url: API_ENDPOINTS.SPONSOR_SEND_MEETING_REQUEST_TO_SPONSOR,
        method: 'POST',
        body: {
          sponsor_id,
          event_id,
          priority,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          meeting_location_option_id,
          meeting_location_other,
          message,
        },
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: true };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['MeetingRequests', 'MeetingRequestOutcomes', 'Attendees', 'Sponsors'],
    }),

    // 7a. Sponsor Meeting Times
    getSponsorMeetingTimes: builder.query({
      query: (args = {}) => {
        const raw = Number(args?.event_id);
        const event_id = (Number.isFinite(raw) && raw > 0) ? raw : 27;
        const params = { event_id, _t: Date.now() };
        if (args?.date != null) params.date = args.date;
        if (args?.target_delegate_id != null) params.target_delegate_id = args.target_delegate_id;
        if (args?.target_sponsor_id != null) params.target_sponsor_id = args.target_sponsor_id;
        if (args?.date_from != null && args?.date_to != null) {
          params.date_from = args.date_from;
          params.date_to = args.date_to;
        }
        return { url: API_ENDPOINTS.SPONSOR_MEETING_TIMES, params };
      },
    }),

    // 7c. Sponsor Meeting Location Options
    getSponsorMeetingLocations: builder.query({
      query: () => ({
        url: API_ENDPOINTS.SPONSOR_MEETING_LOCATIONS,
        params: { _t: Date.now() },
      }),
      keepUnusedDataFor: 0,
      refetchOnMountOrArgChange: true,
    }),

    // 8. View Itinerary (Sponsor)
    getSponsorItinerary: builder.query({
      query: (arg) => {
        const params = { _t: Date.now() };
        const raw = arg?.event_id ?? arg;
        if (raw != null && raw !== '') {
          const n = normalizeEventIdForApi(raw);
          if (n != null) params.event_id = n;
        }
        if (arg?.date) params.date = arg.date;
        return { url: API_ENDPOINTS.SPONSOR_VIEW_ITINERARY, params };
      },
      providesTags: ['Agenda'],
    }),

    sponsorDeleteItineraryMeeting: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.SPONSOR_DELETE_ITINERARY_MEETING,
        method: 'POST',
        body,
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: response.ok };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['Agenda'],
    }),

    sponsorModifyItineraryMeeting: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.SPONSOR_MODIFY_ITINERARY_MEETING,
        method: 'POST',
        body,
        responseHandler: async (response) => {
          const text = await response.text();
          if (!text || !text.trim()) return { success: response.ok };
          try {
            return JSON.parse(text);
          } catch {
            return response.ok ? { success: true } : { success: false, message: text };
          }
        },
      }),
      invalidatesTags: ['Agenda'],
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

    // 11. Send Message (Sponsor) — JSON body or FormData with `attachment` field
    sendSponsorMessage: builder.mutation({
      query: (arg) => {
        const isForm = typeof FormData !== 'undefined' && arg instanceof FormData;
        return {
          url: API_ENDPOINTS.SPONSOR_CHAT_SEND_MESSAGE,
          method: 'POST',
          body: isForm
            ? arg
            : { to_id: arg.to_id, to_type: arg.to_type, message: arg.message },
          prepareHeaders: (headers) => {
            if (isForm) headers.delete('Content-Type');
            return headers;
          },
          responseHandler: async (response) => {
            const text = await response.text();
            if (!text || !text.trim()) return { success: response.ok, message: 'Empty response' };
            try {
              return JSON.parse(text);
            } catch {
              return response.ok
                ? { success: true, message: 'Message may have been saved', data: {} }
                : { success: false, message: text };
            }
          },
        };
      },
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
      // Don't cache - always fetch fresh data
      keepUnusedDataFor: 0,
    }),

    // 13. Get Messages with specific user (Sponsor)
    getSponsorChatMessages: builder.query({
      query: ({ toId, toType }) => {
        if (!toId || !toType) {
          return null;
        }
        return {
          url: API_ENDPOINTS.SPONSOR_CHAT_MESSAGES,
          params: {
            to_id: toId,
            to_type: toType,
            // Add timestamp to force fresh request (bypass cache)
            _t: Date.now(),
          },
        };
      },
      serializeQueryArgs: ({ queryArgs }) => {
        const a = queryArgs;
        if (!a?.toId || !a?.toType) return 'sponsorChat(skip)';
        return `sponsorChat(${Number(a.toId)}:${String(a.toType).toLowerCase()})`;
      },
      providesTags: ['Messages'],
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

    // Push: Register device token for notifications (delegate or sponsor - auth from Bearer)
    registerPushToken: builder.mutation({
      query: ({ token, platform = 'expo' }) => ({
        url: API_ENDPOINTS.PUSH_REGISTER_TOKEN,
        method: 'POST',
        body: { token, platform },
      }),
    }),

    getNotificationInbox: builder.query({
      query: (arg = {}) => {
        const limit = Number(arg?.limit) > 0 ? Math.min(50, Number(arg.limit)) : 10;
        return {
          url: API_ENDPOINTS.NOTIFICATIONS_INBOX,
          params: { limit, _t: Date.now() },
        };
      },
      providesTags: ['NotificationInbox'],
      keepUnusedDataFor: 0,
    }),

    getNotificationUnreadCount: builder.query({
      query: () => ({
        url: API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT,
        params: { _t: Date.now() },
      }),
      providesTags: ['NotificationInbox'],
      keepUnusedDataFor: 0,
    }),

    markNotificationRead: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.NOTIFICATIONS_MARK_READ,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['NotificationInbox'],
    }),

    deleteNotification: builder.mutation({
      query: (body) => ({
        url: API_ENDPOINTS.NOTIFICATIONS_DELETE,
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['NotificationInbox'],
    }),

    // Contact Us form (no auth required)
    submitContactForm: builder.mutation({
      query: ({ full_name, email, message }) => ({
        url: API_ENDPOINTS.CONTACT_SUBMIT,
        method: 'POST',
        body: { full_name, email, message },
      }),
    }),

    /** Heartbeat: marks current token user as active for this event (call periodically). */
    presencePing: builder.mutation({
      query: (body = {}) => ({
        url: API_ENDPOINTS.PRESENCE_PING,
        method: 'POST',
        body,
      }),
    }),

    /** Who is online (recent ping) for this event — not DB status field. */
    getPresenceOnline: builder.query({
      query: ({ event_id, window = 120 }) => {
        const eid = Number(event_id);
        if (!Number.isFinite(eid) || eid <= 0) {
          return null;
        }
        return {
          url: API_ENDPOINTS.PRESENCE_ONLINE,
          params: { event_id: eid, window, _t: Date.now() },
        };
      },
      keepUnusedDataFor: 0,
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
  useRegisterPushTokenMutation,
  useGetNotificationInboxQuery,
  useGetNotificationUnreadCountQuery,
  useMarkNotificationReadMutation,
  useDeleteNotificationMutation,
  useSubmitContactFormMutation,
  usePresencePingMutation,
  useGetPresenceOnlineQuery,

  // Delegate Endpoints
  useGetDelegateEventsQuery,
  useGetUpcomingEventsQuery,
  useGetDelegateEventSponsorLogosQuery,
  useBoothRaffleBoothDetailsMutation,
  useBoothRaffleSubmitMutation,
  useGetAllDelegatesQuery,
  useGetDelegateEventServicesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendDelegateMeetingRequestToDelegateMutation,
  useGetDelegateMeetingRequestsQuery,
  useGetDelegateMeetingRequestOutcomesQuery,
  useDelegateMeetingRequestActionMutation,
  useGetDelegateMeetingTimesQuery,
  useGetDelegateMeetingLocationsQuery,
  useGetAgendaQuery,
  useGetAgendaItemQuery,
  useCheckInAgendaSessionMutation,
  useGetAgendaCheckInStatusQuery,
  useGetDelegateAttendeesQuery,
  useGetDelegateItineraryQuery,
  useDelegateDeleteItineraryMeetingMutation,
  useDelegateModifyItineraryMeetingMutation,
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
  useGetSponsorEventSponsorLogosQuery,
  useGetSponsorEventQuery,
  useGetEventSponsorQuery,
  useGetSponsorMeetingRequestsQuery,
  useGetSponsorMeetingRequestOutcomesQuery,
  useSponsorMeetingRequestActionMutation,
  useGetSponsorServicesQuery,
  useGetSponsorAllAttendeesQuery,
  useSendSponsorMeetingRequestMutation,
  useSendSponsorMeetingRequestToSponsorMutation,
  useGetSponsorMeetingTimesQuery,
  useGetSponsorMeetingLocationsQuery,
  useGetSponsorItineraryQuery,
  useSponsorDeleteItineraryMeetingMutation,
  useSponsorModifyItineraryMeetingMutation,
  useGetSponsorProfileQuery,
  useUpdateSponsorProfileMutation,
  useGetSponsorContactsQuery,
  useSaveSponsorContactMutation,
  useSendSponsorMessageMutation,
  useGetSponsorMessagesQuery,
  useGetSponsorChatMessagesQuery,
  useDeleteSponsorContactMutation,
} = api;
