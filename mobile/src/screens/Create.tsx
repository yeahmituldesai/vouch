import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../navigation';
import { C } from '../theme';
import { Button, ErrorText, Field, Header, Rise, success, tap } from '../ui';
import type { Idea } from '../types';

const CATS = ['Snacks', 'Skincare', 'Clothing', 'Apps'] as const;
const DAYS = [14, 30, 60] as const;

export function CreateScreen() {
  const nav = useNav();
  const { paymentsEnabled: pays, imagesEnabled } = useAuth();
  const [name, setName] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('Snacks');
  const [price, setPrice] = useState('');
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState<(typeof DAYS)[number]>(30);
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr('Photo permission is required'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setPhoto(`data:image/jpeg;base64,${r.assets[0].base64}`);
  }
  const ok = name.trim().length >= 3 && (!pays || Number(price) >= 1) && Number(goal) >= 5 && desc.trim().length >= 10;

  async function publish() {
    setBusy(true); setErr('');
    try {
      const r = await api<{ idea: Idea }>('/ideas', { method: 'POST', body: { name: name.trim(), category: cat, description: desc.trim(), ...(pays ? { priceInr: parseInt(price, 10) } : {}), goal: parseInt(goal, 10), durationDays: days } });
      if (photo && imagesEnabled) { try { await api(`/ideas/${r.idea.id}/image`, { method: 'POST', body: { image: photo } }); } catch { /* image upload optional */ } }
      success();
      nav.replace('Idea', { id: r.idea.id });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong'); }
    setBusy(false);
  }
  const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ height: 36, paddingHorizontal: 15, borderRadius: 18, backgroundColor: on ? C.t : C.s2, justifyContent: 'center', marginRight: 7 }}>
      <Text style={{ color: on ? '#000' : C.t, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="New idea" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
          <Rise>
            <Field label="Product name" value={name} onChangeText={setName} placeholder="Masala Makhana Chips" maxLength={60} />
            <Text style={{ color: C.g, fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{CATS.map((c) => <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />)}</ScrollView>
            <View style={{ flexDirection: 'row' }}>
              {pays ? <Field label="Price (₹)" value={price} onChangeText={(t) => setPrice(t.replace(/\D/g, '').slice(0, 6))} placeholder="149" keyboardType="number-pad" style={{ flex: 1, marginRight: 10 }} /> : null}
              <Field label={pays ? 'Pre-order goal' : 'Goal (interested people)'} value={goal} onChangeText={(t) => setGoal(t.replace(/\D/g, '').slice(0, 6))} placeholder="500" keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <Text style={{ color: C.g, fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>Test duration</Text>
            <View style={{ flexDirection: 'row' }}>{DAYS.map((d) => <Chip key={d} label={`${d} days`} on={days === d} onPress={() => setDays(d)} />)}</View>
            <Field label="What is it?" value={desc} onChangeText={setDesc} placeholder="Tell people what it is and why they would want it" multiline maxLength={500} style={{ minHeight: 110 }} />
            {imagesEnabled ? (<>
              <Text style={{ color: C.g, fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>Photo (optional)</Text>
              <Pressable onPress={pickPhoto} style={{ height: 120, borderRadius: 16, backgroundColor: C.s1, borderWidth: 1, borderColor: C.s3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: C.g, fontSize: 13 }}>Tap to add a photo</Text>}
              </Pressable>
              {photo ? <Pressable onPress={() => setPhoto(null)} style={{ marginTop: 6 }}><Text style={{ color: C.g, fontSize: 12 }}>Remove photo</Text></Pressable> : null}
            </>) : null}
            <Text style={{ color: C.g, fontSize: 12, marginTop: 10, lineHeight: 17 }}>{pays ? 'If your goal is not reached by the deadline, every buyer is refunded automatically.' : 'If enough people show interest by the deadline, you know it is worth building.'}</Text>
            <ErrorText text={err} />
            <View style={{ marginTop: 22 }}><Button title="Publish idea" onPress={publish} loading={busy} disabled={!ok} /></View>
          </Rise>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
