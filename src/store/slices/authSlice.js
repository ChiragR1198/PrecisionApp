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
    // Handle login
    builder.addMatcher(
      api.endpoints.login.matchFulfilled,
      (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.data || action.payload;
        state.error = null;
      }
    );
    
    builder.addMatcher(
      api.endpoints.login.matchRejected,
      (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.error?.message || 'Login failed';
      }
    );
    
    // Handle logout
    builder.addMatcher(
      api.endpoints.logout.matchFulfilled,
      (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      }
    );
  },
});

export const { setAuth, clearAuth, setAuthLoading, setAuthError, clearAuthError } = authSlice.actions;

// Thunk to check auth status on app load
export const checkAuthStatus = () => async (dispatch) => {
  try {
    dispatch(setAuthLoading(true));
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
  }
};

export default authSlice.reducer;
