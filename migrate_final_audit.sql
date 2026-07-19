-- Final security audit fixes

-- 1. Revoke email_for_username from anon (prevents unauthenticated email enumeration)
REVOKE EXECUTE ON FUNCTION public.email_for_username(text) FROM anon;

-- 2. Add crypto wallet columns to the profile UPDATE grant
GRANT UPDATE (crypto_wallet_address, crypto_wallet_currency) ON public.profiles TO authenticated;

-- 3. Add country/state_code to the profile UPDATE grant so users can edit later
GRANT UPDATE (country, state_code) ON public.profiles TO authenticated;

-- 4. Cap get_leaderboard limit server-side (drop+recreate with same return type)
DROP FUNCTION IF EXISTS public.get_leaderboard(text, text, text, integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_metric text, p_region text, p_platform text, p_limit integer
)
RETURNS TABLE(
  id uuid, username text, xp integer, wins integer, losses integer,
  earnings numeric, streak integer, region text, platform text,
  avatar_url text, wagr_member boolean, verified boolean, country text,
  rank_pos bigint
)
LANGUAGE plpgsql STABLE
AS $function$
BEGIN
  RETURN QUERY
    SELECT
      p.id, p.username, p.xp, p.wins, p.losses, p.earnings, p.streak,
      p.region, p.platform, p.avatar_url, p.wagr_member, p.verified, p.country,
      row_number() OVER (
        ORDER BY
          CASE p_metric
            WHEN 'earnings' THEN p.earnings
            WHEN 'streak'   THEN p.streak::numeric
            WHEN 'winpct'   THEN CASE WHEN (p.wins+p.losses) >= 10
                                      THEN p.wins::numeric / nullif(p.wins+p.losses, 0)
                                      ELSE -1 END
            ELSE p.xp::numeric
          END DESC,
          p.xp DESC
      ) AS rank_pos
    FROM public.profiles p
    WHERE (p_region   IS NULL OR p.region   = p_region)
      AND (p_platform IS NULL OR p.platform = p_platform)
      AND (p_metric <> 'winpct' OR (p.wins + p.losses) >= 10)
    LIMIT LEAST(p_limit, 100);
END $function$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text, text, int) TO anon, authenticated;

-- 5. Revoke tournament_cleanup from authenticated (admin-only operation)
REVOKE EXECUTE ON FUNCTION public.tournament_cleanup() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_cleanup() TO service_role;
