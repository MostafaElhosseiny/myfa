import { createHash } from "node:crypto";

export function hashFlag(raw: string): string {
  return createHash("sha256").update(raw.trim(), "utf8").digest("hex");
}
