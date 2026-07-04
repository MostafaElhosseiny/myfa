
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-grant admin role for the configured admin email on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'sasa42@admin.local' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_display TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  points INT NOT NULL DEFAULT 0,
  flags_solved INT NOT NULL DEFAULT 0,
  challenges_completed INT NOT NULL DEFAULT 0,
  first_completed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players public read" ON public.players FOR SELECT TO anon, authenticated USING (true);

-- CHALLENGES (no flags exposed)
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Misc',
  required_flags INT NOT NULL CHECK (required_flags > 0),
  points_per_flag INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges public read" ON public.challenges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write challenges" ON public.challenges FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CHALLENGE FLAGS (hash only, never public)
CREATE TABLE public.challenge_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  flag_hash TEXT NOT NULL,
  flag_order INT NOT NULL,
  UNIQUE (challenge_id, flag_hash)
);
GRANT ALL ON public.challenge_flags TO service_role;
ALTER TABLE public.challenge_flags ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only service_role can touch flags.

-- SUBMISSIONS
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  flag_hash TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX submissions_player_idx ON public.submissions(player_id);
CREATE INDEX submissions_challenge_idx ON public.submissions(challenge_id);
GRANT SELECT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read submissions" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- PROGRESS PER (player, challenge)
CREATE TABLE public.player_challenge_progress (
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  flags_solved INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, challenge_id)
);
GRANT SELECT ON public.player_challenge_progress TO anon, authenticated;
GRANT ALL ON public.player_challenge_progress TO service_role;
ALTER TABLE public.player_challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress public read" ON public.player_challenge_progress FOR SELECT TO anon, authenticated USING (true);

-- Which flag indexes a player has solved for a challenge (to prevent dup credit)
CREATE TABLE public.player_flag_solves (
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  flag_hash TEXT NOT NULL,
  solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, challenge_id, flag_hash)
);
GRANT ALL ON public.player_flag_solves TO service_role;
ALTER TABLE public.player_flag_solves ENABLE ROW LEVEL SECURITY;
-- server-only

-- ACTIVITY
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_created_idx ON public.activity_log(created_at DESC);
GRANT SELECT ON public.activity_log TO anon, authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity public read" ON public.activity_log FOR SELECT TO anon, authenticated USING (true);

-- COMPETITION STATE (single row id=1)
CREATE TABLE public.competition_state (
  id INT PRIMARY KEY DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('upcoming','live','paused','finished')),
  ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.competition_state(id, status) VALUES (1, 'live');
GRANT SELECT ON public.competition_state TO anon, authenticated;
GRANT ALL ON public.competition_state TO service_role;
ALTER TABLE public.competition_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state public read" ON public.competition_state FOR SELECT TO anon, authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_challenge_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
