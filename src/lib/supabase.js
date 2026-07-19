import { createClient } from "@supabase/supabase-js";

// Capture auth callback params BEFORE Supabase client processes (and clears) the URL.
const _hash = new URLSearchParams(window.location.hash.substring(1));
const _search = new URLSearchParams(window.location.search);
export const authCallback = {
  isCallback: _search.has("code") || _hash.has("access_token") || _search.has("error") || _hash.has("error"),
  type: _hash.get("type") || _search.get("type"),
  error: _hash.get("error") || _search.get("error"),
  errorDesc: _hash.get("error_description") || _search.get("error_description"),
  code: _search.get("code"),
};

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client;

if (supabaseConfigured) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    }
  });
} else {
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
    resetPasswordForEmail: err,
    exchangeCodeForSession: err,
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
    then: (resolve) => resolve({ data: [], error: null })
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

// Explicit PKCE code exchange — resolves once the exchange is done (or skipped).
// This prevents race conditions where the app renders before the session is ready.
export const codeExchangePromise = (authCallback.code && supabaseConfigured)
  ? client.auth.exchangeCodeForSession(authCallback.code).then(
      ({ data, error }) => {
        if (error) {
          console.warn("[dubbed] Code exchange failed:", error.message);
          authCallback.error = authCallback.error || "exchange_failed";
          authCallback.errorDesc = authCallback.errorDesc || error.message;
        }
        return { data, error };
      },
      (err) => {
        console.warn("[dubbed] Code exchange threw:", err?.message);
        authCallback.error = authCallback.error || "exchange_failed";
        authCallback.errorDesc = authCallback.errorDesc || (err?.message || "Verification failed. Please log in manually.");
        return { data: null, error: err };
      }
    )
  : Promise.resolve(null);
