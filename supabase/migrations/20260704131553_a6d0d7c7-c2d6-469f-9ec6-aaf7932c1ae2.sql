
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- Add owner-only-nothing policy so linter is happy on server-only tables
CREATE POLICY "no direct access" ON public.challenge_flags FOR SELECT TO authenticated USING (false);
CREATE POLICY "no direct access" ON public.player_flag_solves FOR SELECT TO authenticated USING (false);
