# Admin panel environment

Create a file named `.env.local` in this folder (`admin/`) with one line:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

When the API is deployed on Render, use that address instead — this is the value
you set in the Vercel project settings too:

```
NEXT_PUBLIC_API_URL=https://guessup-api.onrender.com/api
```

Terminal shortcut:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000/api' > .env.local
```
