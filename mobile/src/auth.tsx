import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, setOnUnauthorized, setToken } from './api';
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
    await api('/me/push-token', { method: 'DELETE' }).catch(() => {});
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
          // Fetch the user without blocking the UI. A sleeping free-tier server
          // can take a while, so retry instead of silently signing the user out.
          let me: { user: User } | null = null;
          for (let attempt = 0; attempt < 3 && !me; attempt++) {
            me = await api<{ user: User }>('/me').catch((error) => {
              if (error instanceof ApiError && error.status === 401) throw error;
              return null;
            });
            if (!me) await new Promise((resolve) => setTimeout(resolve, 1500));
          }
          if (me) setUser(me.user);
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
