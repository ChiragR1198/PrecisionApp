import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

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

  useEffect(() => {
    if (isLoading) return; // Don't redirect while checking auth status

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
  }, [isAuthenticated, isLoading, segments]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#8A3490" />
      </View>
    );
  }

  return (
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
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


