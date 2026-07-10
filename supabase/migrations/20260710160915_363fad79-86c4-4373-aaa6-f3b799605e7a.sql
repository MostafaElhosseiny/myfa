
-- Move has_role out of the public API schema so signed-in users can't call it via PostgREST.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Repoint RLS policies to the private version.
DROP POLICY IF EXISTS "admin write challenges" ON public.challenges;
CREATE POLICY "admin write challenges" ON public.challenges
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin read submissions" ON public.submissions;
CREATE POLICY "admin read submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the public-schema copy so it's no longer exposed via the API.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Lock down writes to player_challenge_progress explicitly.
-- No INSERT/UPDATE/DELETE policies means all writes from anon/authenticated are denied;
-- only service_role (used by trusted server functions) can write.
REVOKE INSERT, UPDATE, DELETE ON public.player_challenge_progress FROM anon, authenticated;
