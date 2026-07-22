DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['challenges','challenge_flags','competition_state','players','player_challenge_progress','activity_log']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_flags REPLICA IDENTITY FULL;
ALTER TABLE public.competition_state REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.player_challenge_progress REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;