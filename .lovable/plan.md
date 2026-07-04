# CTF Competition Dashboard — Build Plan

Cyber-themed real-time CTF platform. Preseeded admin (fixed email). Players join by display name only (case-insensitive unique). Flags hashed server-side, validated in server functions, leaderboard streams via Postgres Realtime.

## Stack
- **Frontend**: TanStack Start, React 19, Tailwind v4, Framer Motion, TanStack Query
- **Backend**: Lovable Cloud (Postgres + Auth + Realtime) via server functions
- **Security**: Flags stored as SHA-256 hashes; validation server-only; RLS on all tables; admin gated by `has_role`

## Theme
Neon Cyber — near-black `#05060a` bg, deep indigo panels `#0b1020`, primary violet `#7c3aed`, accent cyan `#22d3ee`. Glassmorphism cards, subtle scanlines, JetBrains Mono for flags/code, Space Grotesk for UI.

## Database (migration)
```
app_role enum: 'admin'
user_roles(user_id, role) + has_role() SECURITY DEFINER
players(id, name_lower UNIQUE, name_display, created_at)
challenges(id, title, description, required_flags, points_per_flag, active, created_at)
challenge_flags(id, challenge_id, flag_hash, flag_order)  -- hash only, never exposed
submissions(id, player_id, challenge_id, flag_hash, correct, submitted_at)
player_challenge_progress(player_id, challenge_id, flags_solved, completed_at)  -- for realtime
competition_state(id=1, status: 'upcoming'|'live'|'paused'|'finished', ends_at)
activity_log(id, player_id, challenge_id, kind, message, created_at)
```
Public SELECT policies (TO anon) on: players (name+points only via view), challenges (no flags), progress, activity, competition_state, leaderboard view. `challenge_flags` — no client access, ever. Full GRANTs per stack rules.

## Server functions (`src/lib/*.functions.ts`)
- `joinAsPlayer(name)` — upsert case-insensitive, returns player id (stored in localStorage)
- `submitFlag(playerId, challengeId, flag)` — hashes, checks `challenge_flags`, rejects duplicates, updates progress, sets `completed_at` if all flags solved, writes activity, returns `{status: 'correct'|'duplicate'|'incorrect'}`
- Admin (require `has_role('admin')`): `createChallenge`, `updateChallenge`, `deleteChallenge`, `resetCompetition`, `resetChallenge`, `resetPlayer`, `pauseCompetition`, `resumeCompetition`, `setEndTime`, `exportCsv`, `exportJson`

## Routes
- `/` — Landing: join by name → player dashboard; live stats + top-3 podium
- `/play` — Player dashboard: challenges grid, per-challenge submit modal, progress bars, my points, activity feed
- `/leaderboard` — Full-screen leaderboard with realtime subscription, search, top-3 podium, confetti when own row hits top 3
- `/auth` — Admin login (email/password)
- `/_authenticated/admin` — Admin panel: challenges CRUD, submissions log, players, competition controls, exports
- `/api/public/*` — none needed (no external webhooks)

## Realtime
Subscribe to `postgres_changes` on `player_challenge_progress`, `activity_log`, `competition_state` → invalidate leaderboard/activity queries. No polling.

## Extras
- Countdown timer bound to `competition_state.ends_at`
- Animated toast on correct flag + confetti on challenge complete
- Stats cards: total players, flags submitted, flags solved, challenges completed, live players (last 5 min)
- Filter/search on challenges + leaderboard

## Setup
1. Enable Lovable Cloud
2. Migration + seed one demo challenge
3. Ask you for the fixed admin email → seed `user_roles` on first login via a trigger (`handle_new_user` checks env-configured admin email and inserts admin role)
4. Build UI, wire realtime, ship

Confirm the admin email to preseed, then I'll build.