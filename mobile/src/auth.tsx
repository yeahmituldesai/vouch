import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setOnUnauthorized, setToken } from './api';
import { registerForPushNotifications } from './push';
import type { User } from './types';

type Ctx = {
  ready: boolean; seen: boolean; user: User | null; paymentsEnabled: boolean;
  finishOnboarding: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pays, setPays] = useState(false);

  const signOut = useCallback(async () => {
    setToken(null); setUser(null);
    await SecureStore.deleteItemAsync('vouch.token').catch(() => {});
  }, []);
  useEffect(() => { setOnUnauthorized(() => { signOut(); }); }, [signOut]);
  useEffect(() => { if (user) registerForPushNotifications(); }, [user]);

  useEffect(() => {
    api<{ paymentsEnabled: boolean }>('/config').then((c) => setPays(c.paymentsEnabled)).catch(() => {});
    (async () => {
      try {
        setSeen((await SecureStore.getItemAsync('vouch.seen')) === '1');
        const t = await SecureStore.getItemAsync('vouch.token');
        if (t) {
          setToken(t);
          // Fetch user in background; don't block the UI on a slow/dead API
          api<{ user: User }>('/me').then((me) => setUser(me.user)).catch(() => { setToken(null); });
        }
      } catch { /* signed out or offline: the Phone screen handles it */ }
      setReady(true);
    })();
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, seen, user, paymentsEnabled: pays,
    finishOnboarding: async () => { setSeen(true); await SecureStore.setItemAsync('vouch.seen', '1'); },
    refresh: async () => { const me = await api<{ user: User }>('/me'); setUser(me.user); },
    signOut,
  }), [ready, seen, user, pays, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
