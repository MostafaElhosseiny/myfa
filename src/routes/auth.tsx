import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/ctf/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin login — CTF/CORE" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/sasa" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/sasa" });
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Terminal className="h-6 w-6 text-cyber-cyan" />
            <h1 className="text-xl font-bold">Admin access</h1>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 h-11 font-mono" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className="mt-1 h-11 font-mono" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 bg-primary text-primary-foreground glow-primary">
              {busy ? "…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-[11px] text-muted-foreground font-mono">
            Admin access only.
          </p>
        </div>
      </main>
    </div>
  );
}
