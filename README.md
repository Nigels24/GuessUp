# GuessUp

Android-Based Gamified Guessing Game Application for Information Technology Students of
J.H. Cerilles State College – Dumingag Campus.

Final defense: **October 15, 2026**

| Package  | What it is              | Stack                                        |
| -------- | ----------------------- | -------------------------------------------- |
| `api/`   | Application layer       | NestJS 12 (TypeScript, ESM), Prisma 6, PostgreSQL |
| `admin/` | Administrator web panel | Next.js 14 (App Router), TypeScript, Tailwind |
| `mobile/`| Student Android app     | Expo SDK 57, React Native, TypeScript         |

Hosting: **Neon** (PostgreSQL) · **Render** (API) · **Vercel** (admin panel) · **Cloudinary** (question images, profile photos).

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

## Step 5: administrator web panel

API (`api/src/admin`, every route `@Roles('ADMIN')`, so a student token gets 403):

- **Categories** `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/:id`: question
  counts per difficulty, unique name (ignoring case) and slug, one emoji icon, hex color. The slug is
  made from the name and cannot change afterwards (the seed identifies categories by it). Delete is
  refused with 409 and the reason while the category has questions or recorded game sessions
- **Questions** `GET/POST /api/admin/questions` (filters: category, difficulty, type, active, search;
  paginated), `GET/PATCH/DELETE /api/admin/questions/:id`, `PATCH /api/admin/questions/:id/active`.
  The server refuses items the game cannot play (`api/src/admin/question.rules.ts`):
  multiple choice needs the answer plus exactly 3 different wrong options (the app shows A–D),
  a picture item needs an image, a word puzzle answer is letters and spaces only, 2–16 letters,
  and Difficult items cannot have a hint. A question with recorded answers (or one in a round
  being played) is **deactivated instead of deleted**, and the response says so. Gameplay only
  ever draws active questions
- **Images** `POST /api/admin/uploads/image` (multipart field `file`): JPG, PNG, WebP or SVG up to
  2 MB, recognized by content; SVGs with scripts or external links are refused. Stored on
  Cloudinary in `guessup/questions`, returns `{ url, publicId }`. Replacing an image or deleting a
  question deletes the old Cloudinary asset (seeded `/static` pictures have no `publicId` and are
  never touched). `DELETE /api/admin/uploads/image?publicId=` discards an upload the form did not
  save. `GET /api/admin/uploads/library` lists the seeded pictures. Without the Cloudinary
  variables the API still starts and uploads answer 503 with a message naming them
- **Students** `GET /api/admin/students` (search, year level, status; rounds, points, accuracy,
  last played), `GET /api/admin/students/:id`, `PATCH /api/admin/students/:id/status`.
  Administrator accounts are never listed and cannot be deactivated here
- **Game sessions** `GET /api/admin/sessions` (student, category, difficulty, status, dates;
  paginated) and `GET /api/admin/sessions/:id` with every answer
- **Reports** `GET /api/admin/reports/activity`, `/scores`, `/most-missed`: `?from=&to=` as
  YYYY-MM-DD (default: the last 30 days, at most 366), `?categoryId=`, and `?format=csv` for a
  download (UTF-8 with BOM, opens in Excel). Most missed takes `?minAttempts=` (default 3, so an
  item answered wrongly once does not top the list). Reports count completed rounds only, and
  days are Philippine time (UTC+8) whatever the server's time zone
- **Dashboard** `GET /api/admin/dashboard`

Admin panel: Dashboard, Question Bank (filters, preview, form per item type with image upload and
a live word-puzzle preview), Categories, Students (with the student detail view), Game Sessions
(with each session's answers) and Reports (period and category filters, Export CSV per report,
Print), laid out as in the prototype.

### Signing in to the admin panel

1. Start the API (`cd api && npm run start:dev`) and the panel (`cd admin && npm run dev`)
2. Open the panel (http://localhost:3001 when the API already uses port 3000) and sign in with an
   administrator account (the one created from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, see
   "Accounts" below). The login page shows no account details; the optional "Demo" box is off
   unless `NEXT_PUBLIC_SHOW_DEMO_LOGIN=true` is in `admin/.env.local` (see `admin/ENV-SETUP.md`)
3. Student accounts are refused with "This account does not have the administrator role."

### Cloudinary (question images)

Create a free Cloudinary account and copy the three values from its dashboard (API Keys).

- Local: in `api/.env`
  ```
  CLOUDINARY_CLOUD_NAME="your-cloud-name"
  CLOUDINARY_API_KEY="123456789012345"
  CLOUDINARY_API_SECRET="your-api-secret"
  ```
  then restart the API
- Render: the API service > Environment > add the same three variables > Save (Render redeploys)

### Deploying the admin panel on Vercel

- New Project > import the repository > **Root Directory: `admin`** (framework: Next.js, default
  build settings)
- Environment variable: `NEXT_PUBLIC_API_URL=https://guessup-api-krgb.onrender.com/api`
  (it is built into the bundle, so redeploy after changing it)
- The API allows any origin (CORS), so no API change is needed for the Vercel address

### Mobile builds

`mobile/eas.json` sets `EXPO_PUBLIC_API_URL=https://guessup-api-krgb.onrender.com/api` for the
`preview` and `production` profiles, so a fresh APK starts on the deployed API. The address can
still be changed on the app's API address screen.

### Notes

- Re-running the seed updates the 105 seeded items (matched by `seedKey`) back to the seed's text,
  so edit seeded items in `api/prisma/seed-data/questions.ts` if the change must survive a re-seed.
  It no longer reactivates seeded items an administrator deactivated, and categories and questions
  added in the panel are left alone
- A question deactivated while a student is in the middle of a round stays in that round; it is
  left out of every round started afterwards

## Step 6: student profile photo

An addition to the prototype: students can add a profile photo. The initials avatar stays
everywhere as the fallback.

- `POST /api/me/avatar` (students only, multipart field `file`): JPG, PNG or WebP up to 2 MB,
  recognized by content (SVG is refused). Returns the updated user. Stored on Cloudinary as
  `guessup/avatars/user-<id>-<timestamp>`, cropped on upload to a 512×512 square around the face
  (`c_fill,g_auto,q_auto`); the saved URL adds `f_auto`. A new photo replaces the old one, and the
  old Cloudinary file is deleted after the new one is saved. 10 requests per minute per account.
  400 with a message for a wrong type, a missing file or a file over 2 MB; 503 without the Cloudinary
  variables; 403 for administrators
- `DELETE /api/me/avatar` (students only): back to the initials, also deletes the Cloudinary file.
  Always 204, also when there is no photo
- `avatarUrl` (never the Cloudinary public id) is now in `GET /api/auth/me`, `GET /api/me` (new,
  same as `/auth/me`), `PATCH /api/me`, the login/register responses, the leaderboard rows and
  `me`, `GET /api/admin/students` and `/students/:id`, and the student in `GET /api/admin/sessions`
  and `/sessions/:id`
- The Cloudinary code is shared (`api/src/cloudinary/`) and only deletes inside the folder it is
  given: avatar code only deletes in `guessup/avatars/`, question code only in
  `guessup/questions/`. Question image uploads are now limited to 1280 px on the longest side
  (`c_limit,q_auto` on upload, `f_auto` in the URL); SVG pictures are stored as they are
- Mobile: tap the photo on Profile (or its camera badge) for Take photo / Choose from gallery /
  Remove photo. The picker crops a square and the phone resizes it to 512×512 JPEG before upload.
  Photos show on Profile, the Home greeting, the leaderboard (podium, rows and your own row). The
  admin panel shows them on Students, the student detail and Game Sessions (no admin upload)

### The migration

`api/prisma/migrations/20261005120000_add_user_avatar` adds two nullable columns to `users`:

```sql
ALTER TABLE "users" ADD COLUMN     "avatarPublicId" TEXT,
ADD COLUMN     "avatarUrl" TEXT;
```

It only adds nullable columns, so an API build from before this step keeps working against the
migrated database. Apply it with `cd api && npx prisma migrate deploy` (Render's build command
runs the same on the next deploy). Apply it before running the e2e tests against a database: the
new Prisma client reads both columns on every user query.

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
cp .env.example .env          # then edit DATABASE_URL and the SEED_* account variables

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
npm run admin:set-password   # change an administrator's password (see "Accounts")
npm test                 # unit tests (game rules, badges, round logic, auth, admin rules, reports, CSV)
npm run test:e2e         # auth, gameplay, student side and admin API; needs the seeded question bank and JWT_SECRET in .env
                         # (the tests make their own e2e-…@example.com accounts and delete them)
npm run prisma:studio    # browse the data
npm run prisma:seed      # re-run the seed (safe to repeat)
npm run prisma:reset     # drop, re-migrate and re-seed

# mobile/
npm run typecheck
npm run build:apk        # eas build -p android --profile preview
```

## Accounts

No passwords are kept in the repository. The seed creates an administrator and a demo student
only from these variables in `api/.env` (see `api/.env.example`):

| Account       | Variables                                       | Password length |
| ------------- | ----------------------------------------------- | --------------- |
| Administrator | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`       | at least 10     |
| Demo student  | `SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD`   | at least 8      |

When a variable is missing the account is skipped with a message (there is no default password).
An account that already exists keeps its password: re-running the seed never changes it.

**Administrators change their own password and name in the panel**: click your name in the top
right (or **My account** at the bottom of the sidebar). A new administrator password needs at least
10 characters and must differ from the current one; a wrong current password is refused.

The script below is **only for recovery**, when an administrator has forgotten the password and
cannot sign in. It sets a new one directly in the database (`DATABASE_URL`), from `api/`:

```bash
read -rs NEW_ADMIN_PASSWORD && export NEW_ADMIN_PASSWORD   # type it; nothing is shown or saved in history
ADMIN_EMAIL=<admin email> npm run admin:set-password
unset NEW_ADMIN_PASSWORD
```

It only changes an account with the ADMIN role, needs at least 10 characters and never prints
the password. Students change theirs in the app (Profile > Change password).

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
