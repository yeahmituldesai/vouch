import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth';
import { Nav } from './src/Nav';
import { useUpdateCheck } from './src/updateCheck';

function UpdateChecker() {
  useUpdateCheck();
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <UpdateChecker />
        <Nav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
