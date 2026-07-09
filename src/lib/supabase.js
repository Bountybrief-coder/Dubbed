import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars prefixed with VITE_. Copy .env.example to .env and fill,
// and set the same vars in your host (e.g. Netlify) BEFORE the build runs —
// Vite inlines them at build time.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Convenience flag the app checks to show a "configure Supabase" banner.
export const supabaseConfigured = Boolean(url && anonKey);

let client;

if (supabaseConfigured) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true // needed for email-verification / magic redirects
    }
  });
} else {
  // No keys: DON'T call createClient (it throws on an empty url and would blank
  // the whole page before React can render). Instead expose a stub that rejects
  // any call gracefully, so the app still mounts and shows the config banner.
  console.warn(
    "[Dubbed] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Set them in your environment (and rebuild) to enable auth and data."
  );

  const err = () =>
    Promise.resolve({ data: null, error: { message: "Supabase is not configured." } });

  const authStub = {
    getSession: () => Promise.resolve({ data: { session: null } }),
    getUser: () => Promise.resolve({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signUp: err,
    signInWithPassword: err,
    signOut: () => Promise.resolve({ error: null }),
    resend: err,
    resetPasswordForEmail: err
  };

  const queryStub = {
    select: () => queryStub,
    insert: err,
    update: () => queryStub,
    delete: () => queryStub,
    eq: () => queryStub,
    ilike: () => queryStub,
    order: () => queryStub,
    limit: () => queryStub,
    match: err,
    maybeSingle: err,
    single: err,
    then: (resolve) => resolve({ data: [], error: null }) // awaitable
  };

  client = {
    auth: authStub,
    from: () => queryStub,
    rpc: err,
    functions: { invoke: err },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {}
  };
}

export const supabase = client;
