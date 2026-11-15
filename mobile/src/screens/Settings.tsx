import React from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { api, ApiError } from '../api';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Button } from '../ui';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch.example.com';

export function Settings() {
  const nav = useNav();
  const { signOut } = useAuth();
  function confirmDelete() {
    Alert.alert('Delete your account?', 'This permanently removes your profile, vouches and feedback. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api('/me', { method: 'DELETE' }); await signOut(); } catch (e) { Alert.alert('Could not delete', e instanceof ApiError ? e.message : 'Try again'); } } }]);
  }
  const Row = ({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable onPress={onPress} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.ln, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: danger ? '#ff453a' : C.t, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: C.dim, fontSize: 16 }}>›</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 }}>
        <Pressable onPress={() => nav.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: C.t, fontSize: 18 }}>←</Text></Pressable>
        <Text style={{ color: C.t, fontSize: 16, fontWeight: '700' }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>Account</Text>
        <Row label="Edit profile" onPress={() => nav.navigate('EditProfile')} />

        <Row label="Notifications" onPress={() => Alert.alert('Notifications', 'Notification preferences coming soon.')} />
        <Row label="Privacy and safety" onPress={() => Linking.openURL(`${WEB}/privacy`)} />
        <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 18, marginBottom: 4 }}>Support</Text>
        <Row label="Help center" onPress={() => Linking.openURL(`${WEB}/support`)} />
        <Row label="Terms of service" onPress={() => Linking.openURL(`${WEB}/terms`)} />
        <Row label="Privacy policy" onPress={() => Linking.openURL(`${WEB}/privacy`)} />
        <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 18, marginBottom: 4 }}>Danger zone</Text>
        <Row label="Sign out" onPress={() => signOut()} danger />
        <Row label="Delete account" onPress={confirmDelete} danger />
        <View style={{ marginTop: 24 }}><Button title="Back" kind="dark" onPress={() => nav.goBack()} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}