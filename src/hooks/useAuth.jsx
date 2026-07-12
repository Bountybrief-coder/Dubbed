import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as auth from "../services/authService";
import { getProfile } from "../services/profileService";

const AuthContext = createContext(null);

const BOOT_TIMEOUT = 4000;
const FAILSAFE_TIMEOUT = 5000;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

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
  const [bootError, setBootError] = useState(null);
  const cancelled = useRef(false);
  const bootStart = useRef(Date.now());

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setIsAdmin(false); return; }

    // getProfile — non-fatal
    let data = null;
    try {
      const res = await withTimeout(getProfile(userId), BOOT_TIMEOUT, "getProfile");
      data = res?.data ?? null;
    } catch (err) {
      console.error("[dubbed] getProfile failed:", err.message);
    }

    if (data?.banned) {
      if (!cancelled.current) setProfile(data);
      setIsAdmin(false);
      return;
    }

    if (data && !data.region) {
      const region = detectRegion();
      try { await supabase.from("profiles").update({ region }).eq("id", userId); } catch {}
      data.region = region;
    }

    if (!cancelled.current) setProfile(data);

    // is_admin — non-fatal, defaults to false
    try {
      const { data: admin } = await withTimeout(supabase.rpc("is_admin"), BOOT_TIMEOUT, "is_admin");
      if (!cancelled.current) setIsAdmin(Boolean(admin));
    } catch (err) {
      console.error("[dubbed] is_admin failed:", err.message);
      if (!cancelled.current) setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    bootStart.current = Date.now();

    // Quick-boot: show the app after 2s even if auth hasn't resolved
    const quickBoot = setTimeout(() => {
      if (!cancelled.current) setLoading(false);
    }, 2000);

    // Absolute failsafe: no matter what, stop loading
    const failsafe = setTimeout(() => {
      if (!cancelled.current) {
        console.error("[dubbed] Boot failsafe triggered — forcing load complete");
        setLoading(false);
        setBootError("Boot timed out. Some features may be unavailable.");
      }
    }, FAILSAFE_TIMEOUT);

    (async () => {
      try {
        let s = null;
        try {
          s = await withTimeout(auth.getSession(), BOOT_TIMEOUT, "getSession");
        } catch (err) {
          console.error("[dubbed] getSession failed:", err.message);
        }

        if (cancelled.current) return;
        setSession(s);

        if (s?.user?.id) {
          try {
            await loadProfile(s.user.id);
          } catch (err) {
            console.error("[dubbed] loadProfile failed:", err.message);
            if (!cancelled.current) setBootError("Profile load failed. Some features may be unavailable.");
          }
        }
      } finally {
        clearTimeout(failsafe);
        clearTimeout(quickBoot);
        if (!cancelled.current) setLoading(false);
      }
    })();

    const unsub = auth.onAuthChange(async (s) => {
      setSession(s);
      try { await loadProfile(s?.user?.id); } catch (err) {
        console.error("[dubbed] onAuthChange loadProfile failed:", err.message);
      }
    });

    return () => {
      cancelled.current = true;
      clearTimeout(failsafe);
      clearTimeout(quickBoot);
      unsub();
    };
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
            setProfile(payload.new);
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
    bootError,
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
