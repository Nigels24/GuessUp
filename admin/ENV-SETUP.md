# Admin panel environment

Create a file named `.env.local` in this folder (`admin/`) with one line:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

When the API is deployed on Render, use that address instead — this is the value
you set in the Vercel project settings too:

```
NEXT_PUBLIC_API_URL=https://guessup-api-krgb.onrender.com/api
```

Terminal shortcut:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000/api' > .env.local
```

## Optional: demo login box

The login page can show a yellow "Demo" box that fills in an account with one
click, for a presentation on your own laptop. It is **off by default** and stays
off unless all three lines are in `.env.local` (restart `npm run dev` after editing):

```
NEXT_PUBLIC_SHOW_DEMO_LOGIN=true
NEXT_PUBLIC_DEMO_EMAIL=<the account's email>
NEXT_PUBLIC_DEMO_PASSWORD=<its password>
```

Do **not** set these on Vercel. Every `NEXT_PUBLIC_*` value is built into the
JavaScript that anyone visiting the panel downloads, so the password would be
public. `.env.local` is git-ignored (`admin/.gitignore`: `.env*.local`), so it
is never committed.
