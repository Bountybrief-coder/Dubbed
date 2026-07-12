import { createClient } from "@supabase/supabase-js";

// Capture auth callback params BEFORE Supabase client processes (and clears) the URL.
const _hash = new URLSearchParams(window.location.hash.substring(1));
const _search = new URLSearchParams(window.location.search);
export const authCallback = {
  isCallback: _search.has("code") || _hash.has("access_token") || _search.has("error") || _hash.has("error"),
  type: _hash.get("type") || _search.get("type"),
  error: _hash.get("error") || _search.get("error"),
  errorDesc: _hash.get("error_description") || _search.get("error_description"),
};

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
