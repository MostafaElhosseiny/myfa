import { Shield } from "lucide-react";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 glass border-b border-glass-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" strokeWidth={2} />
          <span className="font-mono text-sm md:text-base font-bold tracking-wider">
            <span className="text-gradient">CTF</span>
            <span className="text-muted-foreground"> </span>
            <span className="text-foreground">Platform by MYFA</span>
          </span>
        </div>
      </div>
    </header>
  );
}
