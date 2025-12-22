import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, Platform, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { useAuth } from '../src/hooks/useAuth';
import { store } from '../src/store';

// Globally control font scaling to prevent oversized UI when system font/display size is large
// This ensures the app looks consistent regardless of system accessibility settings
// Similar to apps like Paytm, GooglePay that don't change with system font/display size
if (Text && TextInput) {
  if (!Text.defaultProps) Text.defaultProps = {};
  if (!TextInput.defaultProps) TextInput.defaultProps = {};
  
  // Disable font scaling entirely for visual consistency across the app
  // This prevents system font size and display size changes from affecting the app layout
  Text.defaultProps.allowFontScaling = false;
  TextInput.defaultProps.allowFontScaling = false;
  
  // Set max font size multiplier to 1 to prevent any scaling
  // This ensures fonts always render at their specified pixel sizes
  Text.defaultProps.maxFontSizeMultiplier = 1;
  TextInput.defaultProps.maxFontSizeMultiplier = 1;
}

// Note: This global setting applies to all Text and TextInput components
// The app will remain responsive to different screen sizes (phones, tablets)
// but will NOT respond to system font/display size accessibility settings
// All dimensions are pixel-based, ensuring consistent UI across all devices

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Configure navigation bar and status bar visibility
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Ensure navigation bar is visible (works for both gesture and button navigation)
      // This will show navigation bar on all Android devices regardless of navigation mode
      NavigationBar.setVisibilityAsync('visible').catch(console.error);
      NavigationBar.setButtonStyleAsync('dark').catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return; // Don't redirect while checking auth status
    if (!navigationState?.key) return; // Wait for root navigation to be ready

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === '(drawer)';
    const isOnAuthScreen = currentSegment === 'login' || currentSegment === 'register' || 
                          currentSegment === 'forgot-password' || currentSegment === 'email-verification' || 
                          currentSegment === 'reset-password';

    if (!isAuthenticated) {
      // User is not authenticated, redirect to login if trying to access protected routes or at root
      if (inAuthGroup || !currentSegment) {
        router.replace('/login');
      }
    } else {
      // User is authenticated, redirect to dashboard if on auth screens or at root
      if (isOnAuthScreen || !currentSegment) {
        router.replace('/(drawer)/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, segments, navigationState?.key]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <>
        <StatusBar style="dark" translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
          <ActivityIndicator size="large" color="#8A3490" />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.select({ ios: 'slide_from_right', android: 'slide_from_right', default: 'fade' }),
          gestureEnabled: true,
          presentation: 'card',
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="email-verification" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Configure navigation bar on app start
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      // Ensure navigation bar is visible (works for both gesture and button navigation)
      // This will show navigation bar on all Android devices regardless of navigation mode
      NavigationBar.setVisibilityAsync('visible').catch(console.error);
      NavigationBar.setButtonStyleAsync('dark').catch(console.error);
      
      // Also configure on app state changes
      const handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'active') {
          NavigationBar.setVisibilityAsync('visible').catch(console.error);
        }
      };
      
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        subscription?.remove();
      };
    }
  }, []);

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <RootLayoutNav />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}


