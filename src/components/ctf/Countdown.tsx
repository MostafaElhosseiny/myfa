import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatMs(ms: number) {
  const clamped = Math.max(0, ms);
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Countdown({
  endsAt,
  status,
  pausedRemainingMs,
}: {
  endsAt: string | null;
  status: string;
  pausedRemainingMs?: number | null;
}) {
  // Only tick when the challenge is actually live. Paused/finished/upcoming
  // must not decrement — the database is the source of truth.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "live" || !endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status, endsAt]);

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
  if (status === "live" && endsAt) {
    const diff = new Date(endsAt).getTime() - now;
    if (diff > 0) timeLeft = formatMs(diff);
    else timeLeft = "00:00:00";
  } else if (status === "paused" && pausedRemainingMs && pausedRemainingMs > 0) {
    timeLeft = formatMs(pausedRemainingMs);
  } else if (status === "finished") {
    timeLeft = "00:00:00";
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
