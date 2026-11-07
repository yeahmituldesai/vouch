import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Text, TextInput, View } from 'react-native';
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
  const { requestOtp, verifyOtp, refresh } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID ?? '',
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong');

  async function handleGoogle(idToken: string) {
    setBusy(true); setErr('');
    try {
      const r = await api<{ token: string }>('/auth/google', { method: 'POST', body: { idToken } });
      setToken(r.token);
      await SecureStore.setItemAsync('vouch.token', r.token);
      await refresh();
    } catch (e) { setErr(msg(e)); }
    setBusy(false);
  }

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as any)?.id_token ?? response.authentication?.idToken;
      if (idToken) handleGoogle(idToken);
    } else if (response?.type === 'error') {
      setErr('Google sign-in failed. Try again.');
    }
  }, [response]);

  async function send() {
    setBusy(true); setErr('');
    try { await requestOtp(phone); setStep('code'); setCode(''); setWait(30); setTimeout(() => codeRef.current?.focus(), 300); }
    catch (e) { setErr(msg(e)); }
    setBusy(false);
  }
  async function verify(c: string) {
    setBusy(true); setErr('');
    try { await verifyOtp(phone, c); } catch (e) { setErr(msg(e)); setCode(''); }
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingHorizontal: 22 }} >
        <Rise style={{ flex: 1 }}>
          <View style={{ alignItems: 'center', marginTop: 40 }}><Image source={require('../../assets/logo.png')} resizeMode="contain" style={{ width: 140, height: 50 }} accessibilityLabel="Vouch" /></View>
          <Text style={[T.h1, { fontSize: 32, marginTop: 44 }]}>{step === 'phone' ? 'Find out before\nyou launch.' : 'Enter the code'}</Text>
          <Text style={[T.sm, { fontSize: 15, lineHeight: 22, marginTop: 10 }]}>
            {step === 'phone' ? 'Test your idea with real customers and see demand before you spend a rupee.' : `We sent a 6 digit code to +91 ${phone}.`}
          </Text>
          {step === 'phone' ? (
            <View style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, backgroundColor: C.s1, borderWidth: 1, borderColor: C.s3, paddingHorizontal: 16 }}>
              <Text style={{ color: C.t, fontSize: 17, fontWeight: '600' }}>+91</Text>
              <View style={{ width: 1, height: 20, backgroundColor: C.s3, marginHorizontal: 12 }} />
              <TextInput value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} placeholder="Phone number" placeholderTextColor={C.dim}
                keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" autoFocus accessibilityLabel="Phone number" style={{ flex: 1, color: C.t, fontSize: 17 }} />
            </View>
          ) : (
            <TextInput ref={codeRef} value={code} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) verify(d); }}
              keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} accessibilityLabel="6 digit code" placeholder="••••••" placeholderTextColor={C.dim}
              style={{ marginTop: 28, height: 60, borderRadius: 16, backgroundColor: C.s1, borderWidth: 1, borderColor: C.s3, color: C.t, fontSize: 28, fontWeight: '700', letterSpacing: 10, textAlign: 'center' }} />
          )}
          <ErrorText text={err} />
          <View style={{ marginTop: 20 }}>
            {step === 'phone'
              ? <Button title="Continue" onPress={send} loading={busy} disabled={phone.length !== 10} />
              : <Button title="Verify" onPress={() => verify(code)} loading={busy} disabled={code.length !== 6} />}
          </View>
          {step === 'phone' && GOOGLE_CLIENT_ID ? (
            <View style={{ marginTop: 16 }}>
              <Button title="Continue with Google" onPress={() => promptAsync()} loading={busy} disabled={!request} />
            </View>
          ) : null}
          {step === 'code' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
              <Press onPress={() => { setStep('phone'); setErr(''); }}><Text style={{ color: C.g, fontSize: 14, fontWeight: '600' }}>Change number</Text></Press>
              <Text style={{ color: C.dim, marginHorizontal: 10 }}>·</Text>
              <Press onPress={wait > 0 ? undefined : send} disabled={wait > 0}><Text style={{ color: wait > 0 ? C.dim : C.t, fontSize: 14, fontWeight: '600' }}>{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</Text></Press>
            </View>
          ) : null}
        </Rise>
        <Text style={{ color: C.g, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingBottom: 14 }}>
          By continuing you agree to our <Text style={{ color: C.t }} onPress={() => Linking.openURL(`${WEB}/terms`)}>Terms</Text> and <Text style={{ color: C.t }} onPress={() => Linking.openURL(`${WEB}/privacy`)}>Privacy Policy</Text>.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}