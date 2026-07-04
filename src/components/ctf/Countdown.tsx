import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function Countdown({ endsAt, status }: { endsAt: string | null; status: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const label =
    status === "finished"
      ? "FINISHED"
      : status === "paused"
        ? "PAUSED"
        : status === "upcoming"
          ? "UPCOMING"
          : "LIVE";

  const dotColor =
    status === "live"
      ? "bg-cyber-lime"
      : status === "paused"
        ? "bg-yellow-400"
        : status === "finished"
          ? "bg-destructive"
          : "bg-cyber-cyan";

  let timeLeft = "";
  if (endsAt) {
    const diff = new Date(endsAt).getTime() - now;
    if (diff > 0) {
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      timeLeft = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
  }

  return (
    <div className="glass rounded-lg px-3 py-2 flex items-center gap-3 font-mono">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-xs font-bold tracking-widest">{label}</span>
      </div>
      {timeLeft ? (
        <div className="flex items-center gap-1.5 text-cyber-cyan">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-sm">{timeLeft}</span>
        </div>
      ) : null}
    </div>
  );
}
