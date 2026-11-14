import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, LinkingOptions, NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './api';
import { useAuth } from './auth';
import { Icon, IconName } from './Icon';
import { C } from './theme';
import { Press, tap } from './ui';
import { Alerts } from './screens/Alerts';
import { CommentsScreen } from './screens/Comments';
import { CreateScreen } from './screens/Create';
import { DemandScreen } from './screens/Demand';
import { EditProfile } from './screens/EditProfile';
import { Explore } from './screens/Explore';
import { Home } from './screens/Home';
import { IdeaScreen } from './screens/Idea';
import { Onboarding } from './screens/Onboarding';
import { PhoneScreen } from './screens/Phone';
import { PreOrderScreen } from './screens/PreOrder';
import { Profile } from './screens/Profile';
import type { RootParams } from './types';

const Stack = createNativeStackNavigator<RootParams>();
const Tab = createBottomTabNavigator();
const ICONS: Record<string, IconName> = { Home: 'home', Explore: 'search', Alerts: 'bell', Profile: 'user' };

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [unread, setUnread] = useState(0);
  useEffect(() => { api<{ counts: { unread: number } }>('/me').then((r) => setUnread(r.counts.unread)).catch(() => {}); }, [state.index]);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.96)', borderTopWidth: 1, borderTopColor: C.ln, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {state.routes.map((r, i) => {
        if (r.name === 'New') return (
          <Press key={r.key} label="Post an idea" onPress={() => { tap(); (navigation.getParent() as any)?.navigate('Create'); }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.t, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#000" w={2.6} /></Press>
        );
        const on = state.index === i;
        return (
          <Press key={r.key} label={r.name} scale={0.88} onPress={() => { tap(); if (!on) navigation.navigate(r.name); }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ICONS[r.name]} size={24} color={on ? C.t : C.dim} w={on ? 2.2 : 1.8} />
            {r.name === 'Alerts' && unread > 0 && !on ? <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.t, borderWidth: 2, borderColor: C.bg }} /> : null}
            {on ? <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.t }} /> : null}
          </Press>
        );
      })}
    </View>
  );
}
const Dummy = () => null;
function Tabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={Home} /><Tab.Screen name="Explore" component={Explore} />
      <Tab.Screen name="New" component={Dummy} /><Tab.Screen name="Alerts" component={Alerts} /><Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}
const Setup = () => <EditProfile setup />;

const linking: LinkingOptions<RootParams> = {
  prefixes: ['vouch://', process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch.example.com'],
  config: { screens: { Idea: 'i/:id' } },
};

export function Nav() {
  const { ready, seen, user, paymentsEnabled: pays } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.g, fontSize: 14 }}>Loading…</Text></View>;
  return (
    <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.t } }} linking={user && user.name ? linking : undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        {!seen ? <Stack.Screen name="Onboarding" component={Onboarding} options={{ animation: 'fade' }} />
          : !user ? <Stack.Screen name="Phone" component={PhoneScreen} options={{ animation: 'fade' }} />
          : !user.name ? <Stack.Screen name="Setup" component={Setup} />
          : (<>
              <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
              <Stack.Screen name="Idea" component={IdeaScreen} />
              <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              {pays ? <Stack.Screen name="PreOrder" component={PreOrderScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} /> : null}
              <Stack.Screen name="Create" component={CreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="Demand" component={DemandScreen} />
              <Stack.Screen name="EditProfile" component={() => <EditProfile />} />
            </>)}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
