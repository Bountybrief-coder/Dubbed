-- Users to DELETE (test accounts)
-- Admin, ADMIN29, QAbot, TESTADMI, TESTTEST, TESTTEST1234

-- IDs to remove
-- 21a63d3e-d6ae-4087-b547-4b72c7fc4906  Admin
-- 8d95caf0-e3cf-4a51-944b-e3bd2e0faa6b  ADMIN29
-- 016407e5-62ec-4275-86d1-cedc22e94d70  QAbot
-- 9f24cbd7-77aa-4cff-8a31-34c04bd5805c  TESTADMI
-- 88ed3994-02ed-428c-a678-77a1729cd646  TESTTEST
-- 2f6242dc-43ec-4060-87a9-c300f3797217  TESTTEST1234

DO $$
DECLARE
  del_ids uuid[] := ARRAY[
    '21a63d3e-d6ae-4087-b547-4b72c7fc4906',
    '8d95caf0-e3cf-4a51-944b-e3bd2e0faa6b',
    '016407e5-62ec-4275-86d1-cedc22e94d70',
    '9f24cbd7-77aa-4cff-8a31-34c04bd5805c',
    '88ed3994-02ed-428c-a678-77a1729cd646',
    '2f6242dc-43ec-4060-87a9-c300f3797217'
  ];
BEGIN
  -- Clean up all related data for deleted users
  DELETE FROM public.chat_messages WHERE user_id = ANY(del_ids);
  DELETE FROM public.match_disputes WHERE opened_by = ANY(del_ids);
  DELETE FROM public.match_players WHERE user_id = ANY(del_ids);
  DELETE FROM public.team_invites WHERE user_id = ANY(del_ids);
  DELETE FROM public.team_members WHERE user_id = ANY(del_ids);
  DELETE FROM public.team_challenges WHERE from_team_id IN (SELECT id FROM public.teams WHERE owner_id = ANY(del_ids));
  DELETE FROM public.team_challenges WHERE to_team_id IN (SELECT id FROM public.teams WHERE owner_id = ANY(del_ids));
  DELETE FROM public.team_match_history WHERE team_id IN (SELECT id FROM public.teams WHERE owner_id = ANY(del_ids));
  DELETE FROM public.team_members WHERE team_id IN (SELECT id FROM public.teams WHERE owner_id = ANY(del_ids));
  DELETE FROM public.teams WHERE owner_id = ANY(del_ids);
  DELETE FROM public.records WHERE user_id = ANY(del_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(del_ids);
  DELETE FROM public.wallet_ledger WHERE user_id = ANY(del_ids);
  DELETE FROM public.withdrawal_requests WHERE user_id = ANY(del_ids);
  DELETE FROM public.side_bets WHERE user_id = ANY(del_ids);
  DELETE FROM public.bet_offers WHERE creator_id = ANY(del_ids);
  DELETE FROM public.bet_offers WHERE acceptor_id = ANY(del_ids);
  DELETE FROM public.weekly_stats WHERE user_id = ANY(del_ids);
  DELETE FROM public.app_admins WHERE user_id = ANY(del_ids);
  DELETE FROM public.tournament_chat_messages;
  DELETE FROM public.tournament_match_chats;
  DELETE FROM public.tournament_results WHERE user_id = ANY(del_ids);
  DELETE FROM public.tournament_refunds WHERE player_id = ANY(del_ids);
  DELETE FROM public.tournament_matches WHERE user_a = ANY(del_ids) OR user_b = ANY(del_ids);
  DELETE FROM public.tournament_entries WHERE user_id = ANY(del_ids);

  DELETE FROM public.achievements WHERE user_id = ANY(del_ids);

  -- Delete profiles
  DELETE FROM public.profiles WHERE id = ANY(del_ids);

  -- Delete from auth.users (cascade)
  DELETE FROM auth.users WHERE id = ANY(del_ids);
END $$;

-- Now reset ALL stats for remaining users (Bash, Harris, Kry)
UPDATE public.profiles SET
  xp = 0,
  wins = 0,
  losses = 0,
  earnings = 0,
  balance = 0
WHERE true;

-- Clear tournament data first (references matches)
DELETE FROM public.tournament_chat_messages;
DELETE FROM public.tournament_match_chats;
DELETE FROM public.tournament_results;
DELETE FROM public.tournament_refunds;
DELETE FROM public.tournament_matches;
DELETE FROM public.tournament_entries;
DELETE FROM public.tournament_rounds;
DELETE FROM public.tournament_log;
DELETE FROM public.tournament_logs;

-- Clear all match data
DELETE FROM public.match_disputes;
DELETE FROM public.match_players;
DELETE FROM public.matches;

-- Clear records
DELETE FROM public.records;

-- Clear team match history and team stats
DELETE FROM public.team_match_history;
UPDATE public.teams SET wins = 0, losses = 0, earnings = 0, xp = 0, tourney_wins = 0, tourney_losses = 0 WHERE true;

-- Clear weekly stats
DELETE FROM public.weekly_stats;


-- Clear chat messages (fresh start)
DELETE FROM public.chat_messages;

-- Clear notifications
DELETE FROM public.notifications;

-- Clear wallet ledger
DELETE FROM public.wallet_ledger;

-- Clear withdrawal requests
DELETE FROM public.withdrawal_requests;

-- Clear side bets and bet offers
DELETE FROM public.side_bets;
DELETE FROM public.bet_offers;

-- Clear tournament data but keep tournament definitions
DELETE FROM public.tournament_match_chats;
DELETE FROM public.tournament_chat_messages;
DELETE FROM public.tournament_matches;
DELETE FROM public.tournament_results;
DELETE FROM public.tournament_entries;
DELETE FROM public.tournament_refunds;
DELETE FROM public.tournament_rounds;
DELETE FROM public.tournament_log;
DELETE FROM public.tournament_logs;
