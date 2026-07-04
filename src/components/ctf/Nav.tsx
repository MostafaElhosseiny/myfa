import { Link } from "@tanstack/react-router";
import { Shield, Trophy, Terminal, Flag, LogOut } from "lucide-react";
import { usePlayer } from "@/hooks/usePlayer";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { player, hydrated, savePlayer } = usePlayer();

  return (
    <header className="sticky top-0 z-40 glass border-b border-glass-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <Shield className="h-7 w-7 text-cyber-cyan" />
            <span className="absolute inset-0 blur-sm text-cyber-cyan opacity-60"><Shield className="h-7 w-7" /></span>
          </div>
          <span className="font-mono text-sm md:text-base font-bold tracking-wider">
            <span className="text-gradient">CTF</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">CORE</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 md:gap-2">
          <Link
            to="/play"
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            activeProps={{ className: "px-3 py-1.5 rounded-md text-sm text-foreground bg-muted flex items-center gap-1.5" }}
          >
            <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Play</span>
          </Link>
          <Link
            to="/leaderboard"
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            activeProps={{ className: "px-3 py-1.5 rounded-md text-sm text-foreground bg-muted flex items-center gap-1.5" }}
          >
            <Trophy className="h-4 w-4" /> <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <Link
            to="/auth"
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Terminal className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
          </Link>
          {hydrated && player ? (
            <div className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-md glass border-glass-border">
              <span className="text-xs font-mono text-cyber-cyan">@{player.name}</span>
              <button
                onClick={() => savePlayer(null)}
                className="text-muted-foreground hover:text-destructive"
                title="Leave"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
