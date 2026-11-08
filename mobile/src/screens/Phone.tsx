import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { ApiError, api } from '../api';
import { setToken } from '../api';
import { useAuth } from '../auth';
import { C, T } from '../theme';
import { Button, ErrorText, Press, Rise } from '../ui';

WebBrowser.maybeCompleteAuthSession();

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch.example.com';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

export function PhoneScreen() {
  const { refresh } = useAuth();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID ?? '',
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as any)?.id_token ?? response.authentication?.idToken;
      if (idToken) handleGoogle(idToken);
    } else if (response?.type === 'error') {
      setErr('Google sign-in failed. Try again.');
    }
  }, [response]);

  async function handleGoogle(idToken: string) {
    setBusy(true); setErr('');
    try {
      const r = await api<{ token: string }>('/auth/google', { method: 'POST', body: { idToken } });
      setToken(r.token);
      await SecureStore.setItemAsync('vouch.token', r.token);
      await refresh();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong'); }
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingHorizontal: 22 }}>
        <Rise style={{ flex: 1 }}>
          <View style={{ alignItems: 'center', marginTop: 40 }}><Image source={require('../../assets/logo.png')} resizeMode="contain" style={{ width: 140, height: 50 }} accessibilityLabel="Vouch" /></View>
          <Text style={[T.h1, { fontSize: 32, marginTop: 44 }]}>Find out before{'\n'}you launch.</Text>
          <Text style={[T.sm, { fontSize: 15, lineHeight: 22, marginTop: 10 }]}>
            Test your idea with real customers and see demand before you spend a rupee.
          </Text>
          <ErrorText text={err} />
          <View style={{ marginTop: 40 }}>
            {GOOGLE_CLIENT_ID ? (
              <Button title="Continue with Google" onPress={() => promptAsync()} loading={busy} disabled={!request} />
            ) : (
              <Text style={{ color: C.g, fontSize: 13, textAlign: 'center' }}>Sign-in is not configured. Contact support.</Text>
            )}
          </View>
        </Rise>
        <Text style={{ color: C.g, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingBottom: 14 }}>
          By continuing you agree to our <Text style={{ color: C.t }} onPress={() => Linking.openURL(`${WEB}/terms`)}>Terms</Text> and <Text style={{ color: C.t }} onPress={() => Linking.openURL(`${WEB}/privacy`)}>Privacy Policy</Text>.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}