import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';
import { api } from '../api';

// Auth slice for client-side state only
// All API calls are handled by RTK Query
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  },
  reducers: {
    setAuth: (state, action) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.isLoading = false;
    },
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
    },
    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Handle delegate login
    if (api.endpoints?.delegateLogin) {
      builder.addMatcher(
        api.endpoints.delegateLogin.matchFulfilled,
        (state, action) => {
          state.isAuthenticated = true;
          state.user = action.payload.data || action.payload;
          state.error = null;
        }
      );
      
      builder.addMatcher(
        api.endpoints.delegateLogin.matchRejected,
        (state, action) => {
          state.isAuthenticated = false;
          state.user = null;
          state.error = action.error?.message || 'Login failed';
        }
      );
    }

    // Handle sponsor login
    if (api.endpoints?.sponsorLogin) {
      builder.addMatcher(
        api.endpoints.sponsorLogin.matchFulfilled,
        (state, action) => {
          state.isAuthenticated = true;
          state.user = action.payload.data || action.payload;
          state.error = null;
        }
      );

      builder.addMatcher(
        api.endpoints.sponsorLogin.matchRejected,
        (state, action) => {
          state.isAuthenticated = false;
          state.user = null;
          state.error = action.error?.message || 'Login failed';
        }
      );
    }

    // Handle delegate logout
    if (api.endpoints?.delegateLogout) {
      builder.addMatcher(
        api.endpoints.delegateLogout.matchFulfilled,
        (state) => {
          state.isAuthenticated = false;
          state.user = null;
          state.error = null;
        }
      );

      builder.addMatcher(
        api.endpoints.delegateLogout.matchRejected,
        (state) => {
          // Even if logout API fails, clear local state
          state.isAuthenticated = false;
          state.user = null;
          state.error = null;
        }
      );
    }

    // Handle sponsor logout
    if (api.endpoints?.sponsorLogout) {
      builder.addMatcher(
        api.endpoints.sponsorLogout.matchFulfilled,
        (state) => {
          state.isAuthenticated = false;
          state.user = null;
          state.error = null;
        }
      );

      builder.addMatcher(
        api.endpoints.sponsorLogout.matchRejected,
        (state) => {
          // Even if logout API fails, clear local state
          state.isAuthenticated = false;
          state.user = null;
          state.error = null;
        }
      );
    }

  },
});

export const { setAuth, clearAuth, setAuthLoading, setAuthError, clearAuthError } = authSlice.actions;

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

// Token expiry check utility
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

// Thunk to check auth status on app load
export const checkAuthStatus = () => async (dispatch) => {
  try {
    dispatch(setAuthLoading(true));
    
    // Check token expiry first
    const isExpired = await checkTokenExpiry();
    if (isExpired) {
      dispatch(setAuth({ isAuthenticated: false, user: null }));
      return;
    }
    
    const token = await AsyncStorage.getItem('auth_token');
    const storedUser = await AsyncStorage.getItem('auth_user');
    
    if (token && storedUser) {
      const user = JSON.parse(storedUser);
      dispatch(setAuth({ isAuthenticated: true, user }));
    } else {
      dispatch(setAuth({ isAuthenticated: false, user: null }));
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    dispatch(setAuth({ isAuthenticated: false, user: null }));
  } finally {
    dispatch(setAuthLoading(false));
  }
};

export default authSlice.reducer;
