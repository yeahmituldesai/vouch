import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Button, ErrorText, Field, Header, Rise } from '../ui';

export function EditProfile({ setup }: { setup?: boolean }) {
  const nav = useNav();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function uploadAvatar() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    try {
      const dataUrl = 'data:image/jpeg;base64,' + r.assets[0].base64;
      await api('/me/avatar', { method: 'POST', body: { image: dataUrl } });
      await refresh();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Upload failed'); }
  }
  async function uploadBanner() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    try {
      const dataUrl = 'data:image/jpeg;base64,' + r.assets[0].base64;
      await api('/me/banner', { method: 'POST', body: { image: dataUrl } });
      await refresh();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Upload failed'); }
  }
  async function save() {
    setBusy(true); setErr('');
    try {
      await api('/me', { method: 'PATCH', body: { name: name.trim(), handle: handle.trim().toLowerCase(), bio: bio.trim(), location: location.trim(), website: website.trim() } });
      await refresh();
      if (!setup) nav.goBack();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong'); }
    setBusy(false);
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={setup ? undefined : 'Edit profile'} onBack={setup ? undefined : () => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22 }}>
          <Rise>
            {setup ? <><Text style={[T.h1, { fontSize: 32 }]}>Set up your profile</Text><Text style={[T.sm, { fontSize: 15, marginTop: 8, lineHeight: 22 }]}>This is how founders and voters see you.</Text></> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable onPress={uploadAvatar} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: C.s2 }}>
                <Text style={{ color: C.t, fontSize: 13, fontWeight: '600' }}>Change avatar</Text>
              </Pressable>
              <Pressable onPress={uploadBanner} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: C.s2 }}>
                <Text style={{ color: C.t, fontSize: 13, fontWeight: '600' }}>Change banner</Text>
              </Pressable>
            </View>
            <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" maxLength={50} autoCapitalize="words" textContentType="name" />
            <Field label="Handle" value={handle} onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="yourhandle" maxLength={20} autoCapitalize="none" autoCorrect={false} />
            <Field label="Bio" value={bio} onChangeText={setBio} placeholder="One line about you" maxLength={160} multiline />
            <Field label="Location" value={location} onChangeText={setLocation} placeholder="City, Country" maxLength={60} />
            <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://…" maxLength={120} autoCapitalize="none" autoCorrect={false} />
            <ErrorText text={err} />
            <View style={{ marginTop: 24 }}><Button title={setup ? 'Continue' : 'Save'} onPress={save} loading={busy} disabled={!name.trim() || handle.length < 3} /></View>
          </Rise>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
