-- ============================================================================
-- DUBBED RLS SECURITY PATCH
-- Fixes critical vulnerabilities found during RLS audit 2026-07-06
-- ============================================================================

-- ============================================================================
-- 1. REMOVE DANGEROUS INSERT POLICIES
--    These allow users to bypass SECURITY DEFINER RPCs that enforce business
--    logic (entry fee collection, ban checks, capacity limits, etc.)
--    The RPCs themselves run as SECURITY DEFINER so they bypass RLS — they
--    will continue to work after these policies are dropped.
-- ============================================================================

-- match_players: MUST use join_match() RPC — fee collection, ban check, capacity
DROP POLICY IF EXISTS "join match" ON public.match_players;

-- matches: MUST use create_match() RPC — fee collection, format validation, ban check
DROP POLICY IF EXISTS "create match" ON public.matches;

-- match_reports: MUST use report_match() RPC — participation check, auto-settlement
DROP POLICY IF EXISTS "own report" ON public.match_reports;

-- match_disputes: MUST use open_dispute() RPC — participation check
DROP POLICY IF EXISTS "open dispute" ON public.match_disputes;

-- ============================================================================
-- 2. REVOKE BROAD COLUMN GRANTS FROM anon
--    The anon role should never INSERT or UPDATE data in these tables.
--    Service-role and SECURITY DEFINER functions bypass these grants.
-- ============================================================================

REVOKE INSERT, UPDATE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE ON public.wallet_ledger FROM anon;
REVOKE INSERT, UPDATE ON public.payment_events FROM anon;
REVOKE INSERT, UPDATE ON public.payout_events FROM anon;
REVOKE INSERT, UPDATE ON public.withdrawal_requests FROM anon;
REVOKE INSERT, UPDATE ON public.matches FROM anon;
REVOKE INSERT, UPDATE ON public.match_players FROM anon;
REVOKE INSERT, UPDATE ON public.match_reports FROM anon;
REVOKE INSERT, UPDATE ON public.match_disputes FROM anon;
REVOKE INSERT, UPDATE ON public.match_cancel_requests FROM anon;
REVOKE INSERT, UPDATE ON public.bets FROM anon;
REVOKE INSERT, UPDATE ON public.shop_purchases FROM anon;
REVOKE INSERT, UPDATE ON public.stripe_customers FROM anon;
REVOKE INSERT, UPDATE ON public.app_admins FROM anon;
REVOKE INSERT, UPDATE ON public.audit_logs FROM anon;
REVOKE INSERT, UPDATE ON public.user_bans FROM anon;
REVOKE INSERT, UPDATE ON public.tournaments FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_entries FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_matches FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_rounds FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_results FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_refunds FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_logs FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_schedules FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_templates FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_chat_messages FROM anon;
REVOKE INSERT, UPDATE ON public.tournament_match_chats FROM anon;
REVOKE INSERT, UPDATE ON public.trophies FROM anon;
REVOKE INSERT, UPDATE ON public.subscription_events FROM anon;
REVOKE INSERT, UPDATE ON public.username_history FROM anon;
REVOKE INSERT, UPDATE ON public.records FROM anon;
REVOKE INSERT, UPDATE ON public.notifications FROM anon;

-- ============================================================================
-- 3. REVOKE UNSAFE COLUMN GRANTS FROM authenticated
--    Users should not be able to directly INSERT into tables that have
--    business logic enforced via RPCs. Only the RPCs (SECURITY DEFINER)
--    should write to these tables.
-- ============================================================================

-- match_players: only join_match() RPC should insert
REVOKE INSERT ON public.match_players FROM authenticated;

-- matches: only create_match() RPC should insert
REVOKE INSERT ON public.matches FROM authenticated;

-- match_reports: only report_match() RPC should insert
REVOKE INSERT ON public.match_reports FROM authenticated;

-- match_disputes: only open_dispute() RPC should insert
REVOKE INSERT ON public.match_disputes FROM authenticated;

-- wallet_ledger: NEVER directly writable — only RPCs credit/debit
REVOKE INSERT, UPDATE ON public.wallet_ledger FROM authenticated;

-- payment_events: only webhook edge functions via service role
REVOKE INSERT, UPDATE ON public.payment_events FROM authenticated;

-- payout_events: only webhook edge functions via service role
REVOKE INSERT, UPDATE ON public.payout_events FROM authenticated;

-- subscription_events: only webhook edge functions via service role
REVOKE INSERT, UPDATE ON public.subscription_events FROM authenticated;

-- shop_purchases: only webhook edge functions via service role
REVOKE INSERT, UPDATE ON public.shop_purchases FROM authenticated;

-- stripe_customers: only edge functions via service role
REVOKE INSERT, UPDATE ON public.stripe_customers FROM authenticated;

-- app_admins: admin-only table, should not be directly writable
REVOKE INSERT, UPDATE ON public.app_admins FROM authenticated;

-- audit_logs: only RPCs should write
REVOKE INSERT, UPDATE ON public.audit_logs FROM authenticated;

-- user_bans: only admin RPCs should write
REVOKE INSERT, UPDATE ON public.user_bans FROM authenticated;

-- trophies: only settle_tournament/settle_match RPCs should write
REVOKE INSERT, UPDATE ON public.trophies FROM authenticated;

-- username_history: only RPCs should write
REVOKE INSERT, UPDATE ON public.username_history FROM authenticated;

-- withdrawal_requests: only RPCs should write
REVOKE INSERT ON public.withdrawal_requests FROM authenticated;

-- bets: only place_bet() RPC should insert
REVOKE INSERT ON public.bets FROM authenticated;

-- tournaments: only admin_create_tournament() RPC should insert/update
REVOKE INSERT, UPDATE ON public.tournaments FROM authenticated;

-- tournament_entries: only join_tournament() RPC should insert
REVOKE INSERT, UPDATE ON public.tournament_entries FROM authenticated;

-- tournament_matches: only generate_bracket() and advance_bracket() RPCs
REVOKE INSERT, UPDATE ON public.tournament_matches FROM authenticated;

-- tournament_rounds: only generate_bracket() RPC
REVOKE INSERT, UPDATE ON public.tournament_rounds FROM authenticated;

-- tournament_results: only RPCs
REVOKE INSERT, UPDATE ON public.tournament_results FROM authenticated;

-- tournament_refunds: only RPCs
REVOKE INSERT, UPDATE ON public.tournament_refunds FROM authenticated;

-- tournament_logs: only RPCs
REVOKE INSERT, UPDATE ON public.tournament_logs FROM authenticated;

-- tournament_schedules: only admin RPCs
REVOKE INSERT, UPDATE ON public.tournament_schedules FROM authenticated;

-- tournament_templates: only admin RPCs
REVOKE INSERT, UPDATE ON public.tournament_templates FROM authenticated;

-- match_cancel_requests: only request_match_cancel() RPC
REVOKE INSERT ON public.match_cancel_requests FROM authenticated;

-- ============================================================================
-- 4. CLEAN UP DUPLICATE POLICIES (harmless but messy)
-- ============================================================================

DROP POLICY IF EXISTS "admins readable" ON public.app_admins;
DROP POLICY IF EXISTS "disputes readable" ON public.match_disputes;
DROP POLICY IF EXISTS "match players readable" ON public.match_players;
DROP POLICY IF EXISTS "matches readable" ON public.matches;
DROP POLICY IF EXISTS "reports readable" ON public.match_reports;
DROP POLICY IF EXISTS "chat readable" ON public.chat_messages;
DROP POLICY IF EXISTS "entries readable" ON public.tournament_entries;
DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "records readable" ON public.records;
DROP POLICY IF EXISTS "teams readable" ON public.teams;
DROP POLICY IF EXISTS "team members readable" ON public.team_members;
DROP POLICY IF EXISTS "invites readable to invitee/owner" ON public.team_invites;
DROP POLICY IF EXISTS "trophies readable" ON public.trophies;
DROP POLICY IF EXISTS "tournaments readable" ON public.tournaments;
DROP POLICY IF EXISTS "own bets" ON public.bets;
DROP POLICY IF EXISTS "own ledger" ON public.wallet_ledger;

-- ============================================================================
-- DONE. Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- ============================================================================
