-- Add custom label per flag field
ALTER TABLE public.challenge_flags ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Flag';

-- Public read of flag labels + order (never expose flag_hash via API selection; we still guard via grants)
-- Existing policy blocks all direct reads. Add a narrow policy: allow reading only non-sensitive columns via a view.
CREATE OR REPLACE VIEW public.challenge_flag_fields AS
  SELECT id, challenge_id, flag_order, label FROM public.challenge_flags;

GRANT SELECT ON public.challenge_flag_fields TO anon, authenticated;