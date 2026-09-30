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

Not built yet: gameplay, admin CRUD screens, leaderboards, reports.

---

## Requirements

- Node.js 20 or newer (Node 24 recommended; **npm 11+** — npm 10 fails to resolve the API's dev dependencies)
- A PostgreSQL database: local, or a free Neon project

## Setup

```bash
# 1. Database URL
cd api
cp .env.example .env          # then edit DATABASE_URL

# 2. API
npm install                   # also runs prisma generate
npx prisma migrate dev --name init
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

## Useful commands

```bash
# api/
npm run start:dev        # watch mode
npm test                 # unit tests (game rules, auth service)
npm run test:e2e         # health + auth endpoints, needs the seeded database and JWT_SECRET in .env
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
- `api/prisma/seed-data/questions.ts` — all 105 items (15 per category: 5 easy, 5 average, 5 difficult)
- `api/public/images/*.svg` — the pictures for picture-guess items, served at `/static/images/<name>.svg`
- `api/src/common/game-rules.ts` — timers, points, speed bonus, hint penalties

After editing, run `npm run prisma:seed` again.

## Free-tier behavior to explain during the defense

Render's free plan puts the API to sleep after about 15 minutes without traffic, so the first
request afterwards takes roughly 30–50 seconds while the service wakes up; every request after
that is normal. Neon also auto-suspends but wakes in a second or two. Before presenting, open
`/api/health` (or the admin panel) to wake the server, and keep a tab open so it stays awake.
A free uptime pinger hitting `/api/health` every 10 minutes does the same automatically.

## Note for the documentation

The schema adds one table that is **not** in the Chapter III entity relationship diagram
(Figure 3.6): `student_badges`, storing which achievement badges a student has earned.
Badges appear in the Objectives, in the prototype and in Development iteration 5, so the ERD
and its narrative should be updated to include this table before the defense.
