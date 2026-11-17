import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useRoute } from '@react-navigation/native';
import { api } from '../api';
import { showAlert, showActionSheet } from '../alert';
import { ArtGlyph } from '../Art';
import { WEB } from '../config';
import { Icon } from '../Icon';
import { useAuth } from '../auth';
import { inr } from '../format';
import { useNav } from '../navigation';
import { C, T } from '../theme';
import { Avatar, Bar, Button, CountUp, Pill, Press, Rise, success, tap } from '../ui';
import { errMsg, vouchApi } from './Home';
import type { Idea, RootParams } from '../types';

export function IdeaScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootParams, 'Idea'>>();
  const { user, paymentsEnabled: pays } = useAuth();
  const insets = useSafeAreaInsets();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { setIdea((await api<{ idea: Idea }>(`/ideas/${params.id}`)).idea); setErr(''); } catch (e) { setErr(errMsg(e)); }
  }, [params.id]);
  useEffect(() => { load(); const u = nav.addListener('focus', load); return u; }, [load, nav]);

  if (!idea) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={T.sm}>{err || 'Loading…'}</Text>
      <View style={{ marginTop: 20, alignSelf: 'stretch' }}><Button title="Go back" kind="dark" onPress={() => nav.goBack()} /></View>
    </SafeAreaView>
  );
  const mine = idea.owner.id === user?.id;
  const live = idea.status === 'live';

  async function vouch() {
    tap();
    try { const r = await vouchApi(idea!.id); setIdea((x) => x && { ...x, viewer: { ...x.viewer, vouched: r.vouched }, stats: { ...x.stats, vouches: r.count } }); if (r.vouched) success(); }
    catch (e) { showAlert('Could not vouch', errMsg(e)); }
  }
  async function follow() {
    try { const r = await api<{ following: boolean }>(`/users/${idea!.owner.id}/follow`, { method: 'POST' }); setIdea((x) => x && { ...x, viewer: { ...x.viewer, followingOwner: r.following } }); }
    catch (e) { showAlert('Could not follow', errMsg(e)); }
  }
  async function want() {
    tap();
    try { const r = await api<{ wanted: boolean; count: number }>(`/ideas/${idea!.id}/want`, { method: 'POST' }); setIdea((x) => x && { ...x, viewer: { ...x.viewer, wanted: r.wanted }, stats: { ...x.stats, preorders: r.count }, percent: Math.min(100, Math.round((r.count / x.goal) * 100)) }); if (r.wanted) success(); }
    catch (e) { showAlert('Could not save', errMsg(e)); }
  }
  const share = () => Share.share({ message: `Would you buy ${idea.name}? Vouch for it on Vouch.\n${WEB}/i/${idea.id}` });
  function report() {
    const send = (reason: string) => api(`/ideas/${idea!.id}/report`, { method: 'POST', body: { reason } }).then(() => showAlert('Thanks', 'We will review this idea.')).catch((e) => showAlert('Could not report', errMsg(e)));
    showActionSheet({
      title: 'Report this idea',
      message: 'What is wrong with it?',
      options: [
        { text: 'Spam or fake', style: 'default', onPress: () => send('Spam or fake') },
        { text: 'Offensive or unsafe', style: 'default', onPress: () => send('Offensive or unsafe') },
        { text: 'Misleading', style: 'default', onPress: () => send('Misleading') },
        { text: 'Cancel', style: 'cancel' },
      ],
      cancelButtonIndex: 3,
    });
  }
  function block() {
    showAlert(`Block ${idea!.owner.name || '@' + idea!.owner.handle}?`, 'You will no longer see their ideas or comments.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => api(`/users/${idea!.owner.id}/block`, { method: 'POST' }).then(() => nav.goBack()).catch((e) => showAlert('Could not block', errMsg(e))) }]);
  }
  function more() {
    if (!idea || mine) return;
    showActionSheet({
      title: idea.name,
      options: [
        { text: 'Report idea', style: 'default', onPress: report },
        { text: `Block @${idea.owner.handle}`, style: 'destructive', onPress: block },
        { text: 'Cancel', style: 'cancel' },
      ],
      cancelButtonIndex: 2,
      destructiveButtonIndex: 1,
    });
  }
  const cta = mine ? 'This is your idea' : !live ? (idea.status === 'funded' ? 'Goal reached' : 'Closed') : pays ? `Pre-order · ${inr(idea.pricePaise ?? 0)}` : idea.viewer.wanted ? 'You’re interested ✓' : 'I’m interested';
  const Round = ({ icon, onPress, label }: { icon: 'back' | 'share' | 'more'; onPress: () => void; label: string }) => (
    <Press onPress={onPress} label={label} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={icon === 'more' ? 20 : 18} /></Press>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        <LinearGradient colors={['#4a4a4c', '#232325', '#000']} style={{ height: 330, alignItems: 'center', justifyContent: 'center', paddingTop: 50 }}>
          <Rise>{idea.imageUrl ? <Image source={{ uri: idea.imageUrl }} style={{ width: '100%', height: 220, borderRadius: 18 }} resizeMode="cover" /> : <ArtGlyph category={idea.category} size={170} />}</Rise>
        </LinearGradient>
        <View style={{ paddingHorizontal: 18, marginTop: -64 }}>
          <Rise i={1}>
            <Text style={[T.h1, { fontSize: 30, lineHeight: 33 }]}>{idea.name}</Text>
            <Text style={[T.sm, { fontSize: 14, marginTop: 5 }]}>{idea.owner.name || '@' + idea.owner.handle} · {idea.category}</Text>
            <View style={{ flexDirection: 'row', marginTop: 18 }}>
              {[[idea.stats.vouches, 'Vouches', true], [idea.stats.preorders, pays ? 'Pre-orders' : 'Interested', false], [idea.daysLeft, 'Days left', false]].map(([n, l, s]) => (
                <View key={String(l)} style={{ flex: 1 }}><CountUp value={n as number} short={s as boolean} style={{ color: C.t, fontSize: 24, fontWeight: '800', letterSpacing: -0.8 }} /><Text style={{ color: C.g, fontSize: 12 }}>{l as string}</Text></View>
              ))}
            </View>
            <View style={{ marginTop: 16 }}><Bar percent={idea.percent} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}><Text style={T.sm}>{idea.percent}% of goal</Text><Text style={T.sm}>{idea.goal} {pays ? 'pre-orders' : 'people'}</Text></View>
          </Rise>
          <Rise i={2}>
            <Text style={{ color: '#d1d1d6', fontSize: 15, lineHeight: 23, marginTop: 16 }}>{idea.description}</Text>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Pill icon="chat" label={`${idea.stats.comments} feedback`} onPress={() => nav.navigate('Comments', { id: idea.id, name: idea.name })} a11y="Feedback" />
            </View>
            <Press onPress={() => nav.navigate('Demand', { id: idea.id })} label="Demand score" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: C.s1, borderWidth: 1, borderColor: C.s3 }}>
              <View style={{ flex: 1 }}><Text style={{ color: C.t, fontSize: 15, fontWeight: '700' }}>Demand score</Text><Text style={T.sm}>See what the numbers say</Text></View>
              <Text style={{ color: C.t, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>{idea.demand.score}</Text>
            </Press>
            <Pressable onPress={() => nav.navigate('UserProfile', { id: idea.owner.id })} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.ln }}>
              <Avatar name={idea.owner.name || idea.owner.handle} url={idea.owner.avatarUrl} />
              <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: C.t, fontSize: 14, fontWeight: '600' }}>{idea.owner.name || '@' + idea.owner.handle}</Text><Text style={T.sm}>Founder</Text></View>
              {!mine ? <Pill label={idea.viewer.followingOwner ? 'Following' : 'Follow'} on={idea.viewer.followingOwner} onPress={follow} /> : null}
            </Pressable>
          </Rise>
        </View>
      </ScrollView>
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6 }} pointerEvents="box-none">
          <Round icon="back" label="Back" onPress={() => nav.goBack()} />
          <View style={{ flexDirection: 'row' }}>{!mine ? <View style={{ marginRight: 8 }}><Round icon="more" label="More" onPress={more} /></View> : null}<Round icon="share" label="Share" onPress={share} /></View>
        </View>
      </SafeAreaView>
      <LinearGradient colors={['rgba(0,0,0,0)', '#000']} locations={[0, 0.3]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12 + insets.bottom, flexDirection: 'row', alignItems: 'center' }}>
        <Press onPress={vouch} label={idea.viewer.vouched ? 'Remove vouch' : 'Vouch'} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: idea.viewer.vouched ? C.t : C.s2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="vouch" size={26} color={idea.viewer.vouched ? '#000' : C.t} w={2} />
        </Press>
        <View style={{ flex: 1, marginLeft: 10 }}><Button title={cta} disabled={mine || !live} onPress={pays ? () => nav.navigate('PreOrder', { id: idea.id }) : want} /></View>
      </LinearGradient>
    </View>
  );
}
