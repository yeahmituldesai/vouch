import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

type VersionInfo = {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  changelog: string;
  forceUpdate: boolean;
};

// Keeps the prompt from reopening on every foreground resume after "Later".
let promptedFor: number | null = null;

async function checkForUpdate() {
  if (Platform.OS !== 'android') return;
  try {
    const info = await api<VersionInfo>('/app-version');
    const current = Constants.expoConfig?.android?.versionCode ?? 1;
    if (info.versionCode <= current || promptedFor === info.versionCode) return;
    promptedFor = info.versionCode;
    Alert.alert(
      'Update available',
      `Version ${info.versionName} is available.\n\n${info.changelog}`,
      [
        ...(info.forceUpdate ? [] : [{ text: 'Later', style: 'cancel' as const }]),
        {
          text: 'Update',
          // A normal browser opens the GitHub APK download reliably; the
          // in-app browser can swallow the package-archive response.
          onPress: () => { promptedFor = null; Linking.openURL(info.downloadUrl).catch(() => {}); },
        },
      ],
      { cancelable: !info.forceUpdate },
    );
  } catch { /* offline or server waking up */ }
}

export function useUpdateCheck() {
  useEffect(() => {
    checkForUpdate();

    // An update push can arrive while the app is already running.
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'app_update') {
        promptedFor = null;
        checkForUpdate();
      }
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdate();
    });

    return () => { response.remove(); appState.remove(); };
  }, []);
}
