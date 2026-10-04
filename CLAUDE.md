# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GuessUp: a gamified guessing game for IT students (capstone project, final defense October 15, 2026). Three independent npm packages with no root package.json; run commands inside each folder:

| Package   | Stack                                                     | Deployed to |
| --------- | --------------------------------------------------------- | ----------- |
| `api/`    | NestJS 12 (ESM, `"type": "module"`), Prisma 6, PostgreSQL | Render, Neon DB |
| `admin/`  | Next.js 14 App Router, Tailwind                           | Vercel |
| `mobile/` | Expo SDK 57 + Expo Router, React Native, axios            | EAS APK |

`docs/prototype/GuessUp-Prototype.html` is the approved prototype and the reference for behavior, wording, and seed content.

The README's step sections (3A, 3B, 4, 5) describe what is built. Check the source before you assume something from the README exists.

## Commands

npm 11+ is required. npm 10 fails to resolve the API's dev deps and the mobile peer deps, so use `npx npm@11 install` if needed.

```bash
# api/
npm run start:dev                     # http://localhost:3000/api/health
npm run lint                          # oxlint src/ test/
npm test                              # vitest unit tests (**/*.spec.ts)
npx vitest run src/game/game.logic.spec.ts   # single file; add -t "<name>" for one test
npm run test:e2e                      # **/*.e2e-spec.ts against the real DB in api/.env (needs seed + JWT_SECRET)
npm run prisma:seed                   # idempotent upsert
npx prisma migrate dev --name <change>   # after editing schema.prisma; commit the migration folder
npm run prisma:reset                  # DROPS DATA. Never run it against the Neon DB in api/.env

# admin/
npm run dev | npm run build | npm run lint

# mobile/
npx expo start
npm run typecheck
npm run build:apk
```

## Architecture

### API (`api/src`)
- **ESM imports use `.js` suffixes** (`import { X } from './x.js'`) even in `.ts` files.
- `app.setup.ts#configureApp` holds the global prefix `api`, the ValidationPipe (`whitelist` + `forbidNonWhitelisted`, so unknown body fields return 400), CORS, `trust proxy`, and static files (`public/` served at `/static/`). Both `main.ts` and the e2e helper `test/helpers.ts#createApp` call it, so put app-wide settings there and not in `main.ts`.
- **Auth is global.** `AuthModule` registers `JwtAuthGuard` and then `RolesGuard` as `APP_GUARD`. Every route requires a JWT unless it is marked `@Public()`, and `@Roles('ADMIN' | 'STUDENT')` restricts by role. Deactivated users get rejected on every request. Throttling is opt-in per route with `@Throttle`; it is not a global guard. Login is limited per IP + email, register per IP.
- **The game is server-authoritative.** `common/game-rules.ts` holds the timers, points, speed bonus, hint penalties, `ROUND_SIZE`, `ANSWER_GRACE_SECONDS`, and answer checking. `common/badges.ts` defines the 8 badges. `game/game.logic.ts` is pure and has no DB access (round drawing, the item DTO sent to the client, judging) and is unit-tested with an injectable `RandomInt`. `game/game.service.ts` does the DB work.
  - The client never receives the answer, alternates, explanation, or hint before it answers. This is a security boundary: the e2e tests check it with `allKeys()`.
  - Item clock: `GameSession.currentServedAt`. Starting a round serves item 1. `POST /answers` sets the field back to null, and `GET /current` serves the next item and starts its clock, once per item. While it is null, `/answers` and `/hint` return 409.
  - Race and replay safety: state transitions use `updateMany` with a status/version-style `where` inside `$transaction`, and a `count !== 1` result throws `ConflictException` (409). Use the same pattern for new transitions.
  - Finishing a round updates `LeaderboardEntry` and awards badges in the same transaction. `LeaderboardService.categoryRanking` computes ranks; `GET /leaderboard/:categoryId` returns the top 50 plus the caller's row.
  - `me/me.summary.ts` and `me/me.progress.ts` are the pure builders behind `/me/summary` and `/me/progress` (unit-tested). `PATCH /me` and `POST /me/password` are the profile endpoints; a wrong current password is a 400 because both clients sign out on 401.
- Prisma: the migrations in `prisma/migrations/` are the only source of truth for the schema. Deploy uses `prisma migrate deploy`. The `student_badges` table is in the schema but not in the thesis ERD.
- Seed (`prisma/seed.ts`, `prisma/seed-data/`): it upserts questions on a stable `seedKey` (`<category>-<difficulty>-<nn>`). It aborts unless the 7 seeded categories and 105 seeded questions exist, with 5 per category × difficulty (rows added in the admin panel are not counted). It does not touch `isActive` of existing items. Picture-question images are SVGs in `api/public/images/`; uploaded ones are on Cloudinary (`imagePublicId` set).

### Clients
- Both clients use a 60 s request timeout because the Render free tier takes about 50 s to wake. Both turn Nest's `message`, which can be a string or an array of validation messages, into user-facing text. A 401 on a request that carried a token signs the user out.
- **admin**: `src/lib/api.ts` (`apiFetch`, `apiDownload` for CSV, FormData for uploads) uses the base URL from `NEXT_PUBLIC_API_URL` and keeps the token in localStorage. Panel pages live under the `(panel)` route group behind `AdminShell` and `FeedbackProvider` (`components/ui.tsx`: modal, confirm, toast, pills). They call the API's `/api/admin/...` routes (`api/src/admin`); per-type question rules are in `admin/question.rules.ts`, report counting in `admin/reports.logic.ts` (both pure, unit-tested).
- **mobile**: `src/lib/api.ts` reads the API base URL **at runtime from AsyncStorage**, set on `app/settings-api.tsx`, so one APK can target the emulator (`http://10.0.2.2:3000/api`), a LAN laptop, or Render. The JWT is stored in `expo-secure-store`. Routes are grouped as `(auth)` and `(app)`. Seeded images are SVG, which RN `Image` cannot render, so they need `react-native-svg`.

## Accounts
- No credentials in the repo. The seed creates the admin and the demo student only from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and `SEED_STUDENT_EMAIL`/`SEED_STUDENT_PASSWORD`, and never changes an existing account's password. `npm run admin:set-password` (env `ADMIN_EMAIL`, `NEW_ADMIN_PASSWORD`) resets an admin password.
- e2e tests create their own `e2e-…@example.com` accounts with random passwords (`test/helpers.ts#createTestAccount`) and delete them; never log in with a real account in tests.
- The login "Demo" hints (admin and mobile) show only with `NEXT_PUBLIC_SHOW_DEMO_LOGIN` / `EXPO_PUBLIC_SHOW_DEMO_LOGIN` = `true` plus the demo email/password env vars; keep them off in deployed builds.
