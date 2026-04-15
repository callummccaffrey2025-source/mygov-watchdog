import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { setAnalyticsUser } from '../lib/analytics';

interface UserContextType {
  postcode: string | null;
  setPostcode: (code: string | null) => void;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  postcode: null,
  setPostcode: () => {},
  session: null,
  user: null,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [postcode, setPostcodeState] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('postcode').then(v => { if (v) setPostcodeState(v); });
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      // Update analytics identity
      AsyncStorage.getItem('device_id').then(did => setAnalyticsUser(s?.user?.id ?? null, did));

      // Migrate anonymous data on first sign-in
      if (event === 'SIGNED_IN' && s?.user) {
        try {
          const [storedPostcode, storedTopics, deviceId] = await Promise.all([
            AsyncStorage.getItem('postcode'),
            AsyncStorage.getItem('selected_topics'),
            AsyncStorage.getItem('device_id'),
          ]);
          const profileData: Record<string, any> = { user_id: s.user.id };
          if (storedPostcode) profileData.postcode = storedPostcode;
          if (storedTopics) profileData.selected_topics = JSON.parse(storedTopics);
          if (deviceId) profileData.device_id = deviceId;
          await supabase.from('user_preferences').upsert(profileData, { onConflict: 'user_id' });
        } catch {
          // Best-effort migration — don't block sign-in
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const setPostcode = (code: string | null) => {
    setPostcodeState(code);
    if (code) AsyncStorage.setItem('postcode', code);
    else AsyncStorage.removeItem('postcode');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <UserContext.Provider value={{ postcode, setPostcode, session, user: session?.user ?? null, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
