import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { api } from './api';

export function useUpdateCheck() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const info = await api<{ versionCode: number; versionName: string; downloadUrl: string; changelog: string; forceUpdate: boolean }>('/app-version');
        const current = Constants.expoConfig?.android?.versionCode ?? 1;
        if (info.versionCode > current) {
          Alert.alert(
            'Update available',
            `Version ${info.versionName} is available.\n\n${info.changelog}`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Download', onPress: () => WebBrowser.openBrowserAsync(info.downloadUrl) },
            ],
            { cancelable: !info.forceUpdate }
          );
        }
      } catch { /* ignore */ }
    })();
  }, []);
}