# GuessUp

Android-Based Gamified Guessing Game Application for Information Technology Students of
J.H. Cerilles State College – Dumingag Campus.

Final defense: **October 15, 2026**

| Package  | What it is              | Stack                                        |
| -------- | ----------------------- | -------------------------------------------- |
| `api/`   | Application layer       | NestJS 12 (TypeScript, ESM), Prisma 6, PostgreSQL |
| `admin/` | Administrator web panel | Next.js 14 (App Router), TypeScript, Tailwind |
| `mobile/`| Student Android app     | Expo SDK 57, React Native, TypeScript         |

Hosting: **Neon** (PostgreSQL) · **Render** (API) · **Vercel** (admin panel) · **Cloudinary** (images, later).

The approved prototype of every screen and game rule is in
`docs/prototype/GuessUp-Prototype.html` — open it in a browser. It is the reference for
behavior, wording and seed content.

---

## What is built so far (step 1)

- Database schema for all 6 documented tables plus `student_badges`
- Seed data: 7 categories, 105 questions, 24 question images, 2 accounts
- Game rules (timers, points, hint penalties, answer checking) with unit tests, on the server
- `GET /api/health` and static image serving
- Admin page that checks the API connection
- Mobile starter screen where the API address can be set and tested

## Step 2: authentication

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (JWT, bcrypt cost 10)
- Every API route requires a token unless marked `@Public()`; `@Roles('ADMIN')` restricts admin routes
- Deactivated accounts lose access on their next request
- Login and register are rate-limited to 5 requests per minute per IP (HTTP 429 after that)
- Admin panel: `/login`, protected sidebar layout, `/dashboard` greeting, `/status` API check
- Mobile app: Expo Router with login, register, home placeholder and the API address screen
  (gear button on the login screen); the token is kept in `expo-secure-store`

## Step 3A: gameplay API

- `GET /api/categories` and the `/api/game/...` endpoints: start a round, current item, hint,
  answer, finish, abandon, read a finished round, history
- Server-authoritative: the app never receives an answer before answering, the timer runs from
  a server timestamp (+2 s network grace, `ANSWER_GRACE_SECONDS`), and points are computed with
  `game-rules.ts`. A replayed or duplicate request gets 409 instead of scoring twice
- Finishing a round updates the per-category leaderboard and awards the 8 prototype badges
  (`api/src/common/badges.ts`)

## Step 3B: mobile gameplay

- **Timer change on the server:** `POST /answers` no longer returns the next item and no longer
  starts its clock. The app calls `GET /game/sessions/:id/current` when the student taps
  "Next question"; that call starts the item's clock with the full time. Time spent reading the
  feedback and explanation is not counted. `/answers` and `/hint` on an item that was never sent
  return 409.
- `GET /api/me/summary` (students): total points, rounds, badges and per-category rounds,
  accuracy and best score, from completed rounds only
- Mobile app: Home (greeting, "Ready to guess?" card, 7 categories, recent rounds, pull to
  refresh), bottom tabs (Ranks, Progress and Profile are placeholders except Log out on Profile),
  level picker sheet, play screen for all three item types, feedback sheet, result screen
- The play screen redraws from the server after an app restart or a return to the app, timer
  included. Leaving the round (✕ or Android back) asks first, then abandons it.
- Seeded pictures are SVG files, which React Native's `Image` cannot draw, so the app uses
  `react-native-svg` for them

## Step 4: leaderboard, progress, profile

- `GET /api/leaderboard/:categoryId` (any signed-in user): rankings per subject category only,
  by accumulated points, then accuracy; active students only. Returns the top 50 and the
  caller's own row (`me`), also when it is outside the top 50. 404 for an unknown category
- `GET /api/me/progress` (students, completed rounds only): rounds, points, accuracy, accuracy by
  subject, the 5 most missed topics ("Topics to review") and the latest 20 rounds
- `PATCH /api/me` (full name, year level) and `POST /api/me/password` (current + new password,
  bcrypt cost 10). A wrong current password is a 400, not a 401, because the apps sign out on 401.
  Password changes are limited to 10 per minute per account
- `GET /api/me/summary` also lists all 8 badges (`allBadges`) for the badge grid
- Mobile app: Ranks (category chips, podium, own row pinned, "Play now"), My Progress, and Profile
  (badges, Edit profile, Change password, About, Log out). The result screen's rank card has
  "View", which opens Ranks on that category. "Play now" and "Practice" open Home with the level
  picker for that category

Not built yet: admin CRUD screens, reports.

---

## Requirements

- Node.js 20 or newer (Node 24 recommended; **npm 11+** — npm 10 fails to resolve the API's dev
  dependencies and the mobile app's peer dependencies. Without npm 11 installed, use
  `npx npm@11 install` in place of `npm install`)
- A PostgreSQL database: local, or a free Neon project

## Setup

```bash
# 1. Database URL
cd api
cp .env.example .env          # then edit DATABASE_URL

# 2. API
npm install                   # also runs prisma generate
npx prisma migrate dev        # applies the committed migrations in prisma/migrations
npm run prisma:seed
npm run start:dev             # http://localhost:3000/api/health

# 3. Admin panel (new terminal)
cd ../admin
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000 -> if taken, Next picks 3001

# 4. Mobile app (new terminal)
cd ../mobile
npm install
npx expo start                # press a for Android, or scan with Expo Go
```

On the mobile app's API address screen (gear button on the login screen), set the API address:

- Android emulator: `http://10.0.2.2:3000/api`
- Real phone on the same Wi-Fi: `http://<your-laptop-IP>:3000/api` (e.g. `http://192.168.1.10:3000/api`)
- Deployed API: `https://<your-service>.onrender.com/api`

The address is saved on the device, so switching between local and deployed needs **no new APK**.

### Migrations: development vs deployment

The migrations in `api/prisma/migrations/` are committed and are the only source of the
database structure.

- **Local development:** `npx prisma migrate dev`. It applies the committed migrations. After
  you change `schema.prisma`, run `npx prisma migrate dev --name <what-changed>` to create a
  new migration, and commit that folder with the schema change.
- **Deployment (Render against Neon):** `npx prisma migrate deploy`. It only applies committed
  migrations and never resets data, e.g. as the Render build command
  `npm install && npx prisma migrate deploy && npm run build`.

## Useful commands

```bash
# api/
npm run start:dev        # watch mode
npm test                 # unit tests (game rules, badges, round logic, auth service)
npm run test:e2e         # auth + a full game round, needs the seeded database and JWT_SECRET in .env
npm run prisma:studio    # browse the data
npm run prisma:seed      # re-run the seed (safe to repeat)
npm run prisma:reset     # drop, re-migrate and re-seed

# mobile/
npm run typecheck
npm run build:apk        # eas build -p android --profile preview
```

## Demo accounts (seeded)

| Role          | Email                   | Password     |
| ------------- | ----------------------- | ------------ |
| Administrator | admin@jhcsc.edu.ph      | `admin123`   |
| Student       | student@jhcsc.edu.ph    | `student123` |

Passwords are hashed with bcrypt (cost 10) before storage, as stated in Chapter II.

## Editing the seed content

- `api/prisma/seed-data/categories.ts` — the 7 subject categories
- `api/prisma/seed-data/questions.ts` — all 105 items (15 per category: 5 easy, 5 average, 5 difficult).
  Each item has a fixed `seedKey` (`<category>-<difficulty>-<nn>`, e.g. `net-easy-03`) that the seed
  upserts on; keep the key when you edit an item, and give a new item a new key. Question texts
  may repeat inside a category (the picture tells picture items apart).
- `api/public/images/*.svg` — the pictures for picture-guess items, served at `/static/images/<name>.svg`
- `api/src/common/game-rules.ts` — timers, points, speed bonus, hint penalties

After editing, run `npm run prisma:seed` again. The seed stops with an error unless there are
7 categories, 105 questions and exactly 5 items for every category and difficulty.

## Free-tier behavior to explain during the defense

Render's free plan puts the API to sleep after about 15 minutes without traffic, so the first
request afterwards takes roughly 30–50 seconds while the service wakes up; every request after
that is normal. Neon also auto-suspends but wakes in a second or two. Before presenting, open
`/api/health` (or the admin panel) to wake the server, and keep a tab open so it stays awake.
A free uptime pinger hitting `/api/health` every 10 minutes does the same automatically.

## Known limits

- **Login rate limit is keyed on IP address + email.** A whole class on the school Wi-Fi shares
  one public IP, so a limit per IP alone would let one student's wrong passwords lock out the
  room. Login allows 10 attempts per minute for each IP + email; the 11th gets HTTP 429 ("Too
  many attempts. Please wait a minute and try again."). Registration allows 5 per minute per IP,
  so a class registering at once on shared Wi-Fi should do it a few at a time. The counters are
  kept in the API's memory: they reset when the server restarts, and they would not be shared if
  the API ever ran on more than one instance.

## Note for the documentation

The schema adds one table that is **not** in the Chapter III entity relationship diagram
(Figure 3.6): `student_badges`, storing which achievement badges a student has earned.
Badges appear in the Objectives, in the prototype and in Development iteration 5, so the ERD
and its narrative should be updated to include this table before the defense.
