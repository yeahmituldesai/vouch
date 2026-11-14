import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null; // simulators/emulators
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
      });
    }

    // Standalone Android builds get a real FCM token, which the API delivers
    // through Firebase Cloud Messaging (HTTP v1). Expo Go has no FCM config,
    // so fall back to an Expo push token there.
    let token: string | null = null;
    if (Platform.OS === 'android') {
      try {
        token = (await Notifications.getDevicePushTokenAsync()).data as string;
      } catch {
        token = null;
      }
    }
    if (!token) {
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch {
        token = null;
      }
    }
    if (!token) return null;

    await api('/me/push-token', { method: 'POST', body: { token } }).catch(() => {});
    return token;
  } catch {
    return null;
  }
}
