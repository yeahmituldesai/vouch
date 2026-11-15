import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { AuthProvider } from './src/auth';
import { ErrorBoundary } from './src/ErrorBoundary';
import { Nav } from './src/Nav';
import { useUpdateCheck } from './src/updateCheck';

// Initialize Sentry for crash and error reporting.
// Set SENTRY_DSN in your mobile .env to enable reporting.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

function UpdateChecker() {
  useUpdateCheck();
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StatusBar style="light" />
          <UpdateChecker />
          <Nav />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
