// Shared helpers for Dubbed's Stripe Connect edge functions.
// Deno runtime (Supabase Edge Functions). No secrets are ever sent to the client.
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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

export function stripeClient(): Stripe {
  return new Stripe(env("STRIPE_SECRET_KEY"), {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
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
