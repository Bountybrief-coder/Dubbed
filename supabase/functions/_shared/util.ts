// Shared helpers for Dubbed's Edge Functions (NOWPayments + Supabase).
// Deno runtime (Supabase Edge Functions). No secrets are ever sent to the client.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "https://deno.land/std@0.224.0/crypto/mod.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const NP_BASE = "https://api.nowpayments.io/v1";

export async function npFetch(path: string, opts: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const res = await fetch(`${NP_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "x-api-key": env("NOWPAYMENTS_API_KEY"),
      "Content-Type": "application/json",
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `NOWPayments ${res.status}`);
  return data;
}

// Verify NOWPayments IPN signature (HMAC-SHA512 of sorted JSON body).
export async function verifyIPN(body: string, sig: string): Promise<boolean> {
  const secret = env("NOWPAYMENTS_IPN_SECRET");
  const parsed = JSON.parse(body);
  const sorted = JSON.stringify(sortKeys(parsed));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(sorted));
  const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === sig;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj as Record<string, unknown>).sort().reduce((acc: Record<string, unknown>, key) => {
    acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
    return acc;
  }, {});
}

// Service-role client — bypasses RLS. Only ever used inside edge functions,
// never exposed to the browser.
export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Resolves the calling user from the request's Authorization bearer token.
// Returns null if unauthenticated.
export async function getCaller(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}
