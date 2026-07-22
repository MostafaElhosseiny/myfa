
-- Track solves by specific flag id (not by hash) so duplicate flag answers
-- inside a challenge count as independent flags.
ALTER TABLE public.player_flag_solves
  ADD COLUMN IF NOT EXISTS flag_id uuid REFERENCES public.challenge_flags(id) ON DELETE CASCADE;

-- Backfill any existing rows to the first matching flag for their hash.
UPDATE public.player_flag_solves s
SET flag_id = f.id
FROM public.challenge_flags f
WHERE s.flag_id IS NULL
  AND f.challenge_id = s.challenge_id
  AND f.flag_hash = s.flag_hash;

-- Drop rows we couldn't map (should be none in normal use).
DELETE FROM public.player_flag_solves WHERE flag_id IS NULL;

ALTER TABLE public.player_flag_solves ALTER COLUMN flag_id SET NOT NULL;

-- Drop any existing PK / unique that keyed on flag_hash and replace with a
-- per-flag-id unique so each flag has its own independent solved state.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.player_flag_solves'::regclass
      AND contype IN ('p','u')
  LOOP
    EXECUTE format('ALTER TABLE public.player_flag_solves DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.player_flag_solves
  ADD CONSTRAINT player_flag_solves_pkey PRIMARY KEY (player_id, flag_id);

CREATE INDEX IF NOT EXISTS player_flag_solves_challenge_idx
  ON public.player_flag_solves (player_id, challenge_id);
