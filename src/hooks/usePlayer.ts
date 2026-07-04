import { useEffect, useState, useCallback } from "react";

const KEY = "ctf.player";
export type StoredPlayer = { id: string; name: string };

function read(): StoredPlayer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function usePlayer() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlayer(read());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPlayer(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((p: StoredPlayer | null) => {
    if (typeof window === "undefined") return;
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
    setPlayer(p);
  }, []);

  return { player, hydrated, savePlayer: save };
}
