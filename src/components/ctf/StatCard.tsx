import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "cyan" | "violet" | "lime" | "magenta";
}) {
  const colorClass =
    accent === "cyan"
      ? "text-cyber-cyan"
      : accent === "lime"
        ? "text-cyber-lime"
        : accent === "magenta"
          ? "text-cyber-magenta"
          : "text-cyber-violet";
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-lg grid place-items-center bg-background/50 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}
