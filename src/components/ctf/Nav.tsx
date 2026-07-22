import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import { supabase } from "@/integrations/supabase/client";

export function Nav() {
  const { player, hydrated } = usePlayer();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const showLabel = (hydrated && player) || hasSession;
  const label = player?.name ?? (hasSession ? "admin" : "");

  return (
    <header className="sticky top-0 z-40 glass border-b border-glass-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Shield className="h-7 w-7 text-cyber-cyan" />
            <span className="absolute inset-0 blur-sm text-cyber-cyan opacity-60">
              <Shield className="h-7 w-7" />
            </span>
          </div>
          <span className="font-mono text-sm md:text-base font-bold tracking-wider">
            <span className="text-gradient">CTF</span>
            <span className="text-muted-foreground"> </span>
            <span className="text-foreground">Platform</span>
          </span>
        </div>
        {showLabel && label ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md glass border-glass-border">
            <span className="text-xs font-mono text-cyber-cyan">@{label}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
