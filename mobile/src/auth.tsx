import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, setOnUnauthorized, setToken } from './api';
import { registerForPushNotifications } from './push';
import type { User } from './types';

type Ctx = {
  ready: boolean; seen: boolean; user: User | null; paymentsEnabled: boolean; imagesEnabled: boolean;
  finishOnboarding: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

const USER_KEY = 'vouch.user';

async function saveUser(user: User | null) {
  if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
  else await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pays, setPays] = useState(false);
  const [images, setImages] = useState(false);

  const signOut = useCallback(async () => {
    // Best effort: detach this device from the account, then clear it locally.
    void api('/me/push-token', { method: 'DELETE', skipAuthHandler: true }).catch(() => {});
    setToken(null); setUser(null);
    await Promise.all([
      SecureStore.deleteItemAsync('vouch.token').catch(() => {}),
      saveUser(null),
    ]);
  }, []);
  useEffect(() => { setOnUnauthorized(() => { signOut(); }); }, [signOut]);
  useEffect(() => { if (user) registerForPushNotifications(); }, [user]);

  useEffect(() => {
    api<{ paymentsEnabled: boolean; imagesEnabled?: boolean }>('/config').then((c) => { setPays(c.paymentsEnabled); setImages(!!c.imagesEnabled); }).catch(() => {});
    (async () => {
      try {
        setSeen((await SecureStore.getItemAsync('vouch.seen')) === '1');
        const t = await SecureStore.getItemAsync('vouch.token');
        if (t) {
          setToken(t);
          // Show the cached profile immediately, then refresh in the background.
          // A sleeping free-tier server can take a while and must never make a
          // signed-in user look signed out.
          const cached = await SecureStore.getItemAsync(USER_KEY).catch(() => null);
          if (cached) {
            try { setUser(JSON.parse(cached) as User); } catch { /* ignore bad cache */ }
          }
          api<{ user: User }>('/me')
            .then((me) => { setUser(me.user); saveUser(me.user); })
            .catch((error) => {
              if (error instanceof ApiError && error.status === 401) signOut();
            });
        }
      } catch { /* signed out or offline: the sign-in screen handles it */ }
      setReady(true);
    })();
  }, [signOut]);

  const value = useMemo<Ctx>(() => ({
    ready, seen, user, paymentsEnabled: pays, imagesEnabled: images,
    finishOnboarding: async () => { setSeen(true); await SecureStore.setItemAsync('vouch.seen', '1'); },
    refresh: async () => { const me = await api<{ user: User }>('/me'); setUser(me.user); saveUser(me.user); },
    signOut,
  }), [ready, seen, user, pays, images, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
