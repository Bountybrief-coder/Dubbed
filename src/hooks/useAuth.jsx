import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import * as auth from "../services/authService";
import { getProfile } from "../services/profileService";

const AuthContext = createContext(null);

function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/America\/(Mexico|Bogota|Lima|Santiago|Buenos|Sao_Paulo|Caracas|Havana|Guatemala|Tegucigalpa|Managua|Panama|Asuncion|Montevideo|La_Paz|Guayaquil|Belem|Fortaleza|Recife|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Boa_Vista|Santarem|Araguaina|Maceio|Bahia|Cayenne|Paramaribo|Costa_Rica|El_Salvador)/i.test(tz)) return "Latin America";
    if (/Europe|Africa\/(Casablanca|Tunis|Algiers|Cairo)|Asia\/(Istanbul|Nicosia)/i.test(tz)) return "EU";
    if (/America|US|Canada|Pacific\/Honolulu/i.test(tz)) return "NA";
    return "NA";
  } catch { return "NA"; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setIsAdmin(false); return; }
    const { data } = await getProfile(userId);
    if (data?.banned) {
      await auth.signOut();
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    if (data && !data.region) {
      const region = detectRegion();
      await supabase.from("profiles").update({ region }).eq("id", userId);
      data.region = region;
    }
    setProfile(data || null);
    const { data: admin } = await supabase.rpc("is_admin");
    setIsAdmin(Boolean(admin));
  }, []);

  useEffect(() => {
    // Initial session
    auth.getSession().then(async (s) => {
      setSession(s);
      await loadProfile(s?.user?.id);
      setLoading(false);
    });
    // Live updates
    const unsub = auth.onAuthChange(async (s) => {
      setSession(s);
      await loadProfile(s?.user?.id);
    });
    return unsub;
  }, [loadProfile]);

  // Keep the profile fresh when balance/xp change elsewhere (realtime).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const channel = supabase
      .channel(`profile:${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        (payload) => {
          if (payload.new?.banned) {
            auth.signOut();
            setSession(null);
            setProfile(null);
            setIsAdmin(false);
            return;
          }
          setProfile(payload.new);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    isAdmin,
    loading,
    refreshProfile: () => loadProfile(session?.user?.id),
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: async () => {
      await auth.signOut();
      setProfile(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
