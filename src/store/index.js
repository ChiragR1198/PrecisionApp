import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from './slices/authSlice';
import eventReducer from './slices/eventSlice';

// AGGRESSIVE cleanup of ALL old Redux/persist state
const clearOldReduxState = async () => {
  try {
    console.log('🧹 Starting aggressive state cleanup...');
    const keys = await AsyncStorage.getAllKeys();
    console.log(`📦 Found ${keys.length} total keys in AsyncStorage`);
    
    // Only keep auth_token and auth_user, remove EVERYTHING else
    const keysToKeep = ['auth_token', 'auth_user'];
    const keysToRemove = keys.filter(key => !keysToKeep.includes(key));
    
    if (keysToRemove.length > 0) {
      console.log(`🗑️  Removing ${keysToRemove.length} old keys:`, keysToRemove);
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('✅ Cleared all old state successfully!');
    } else {
      console.log('✅ No old state to clear');
    }
  } catch (error) {
    console.error('❌ Failed to clear old state:', error);
  }
};

// Run cleanup SYNCHRONOUSLY before store creation
let cleanupComplete = false;
clearOldReduxState().then(() => {
  console.log('✅ Store cleanup complete');
  cleanupComplete = true;
}).catch(err => {
  console.error('Cleanup error:', err);
  cleanupComplete = true;
});

// Create store with ONLY auth and api reducers (clean slate)
export const store = configureStore({
  reducer: {
    auth: authReducer,
    event: eventReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['api/executeQuery/fulfilled', 'api/executeMutation/fulfilled'],
        ignoredActionPaths: ['meta.arg', 'payload.timestamp', 'meta.baseQueryMeta'],
        ignoredPaths: ['api'],
      },
      // Disable immutability check to improve performance
      immutableCheck: false,
    }).concat(api.middleware),
  // Force clean state (no preloaded state from anywhere)
  preloadedState: undefined,
  devTools: false, // Disable DevTools to prevent interference
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
