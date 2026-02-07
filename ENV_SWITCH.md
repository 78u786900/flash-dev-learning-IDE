# Environment Switch: Local vs Production

Quick guide to switch between local development and production when testing Google Drive / OAuth.

---

## Google Cloud Console (One-time setup)

Add **both** redirect URIs to your OAuth 2.0 credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Edit your OAuth 2.0 Client ID (Web application)
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:3001/api/auth/callback` — for local
   - `https://YOUR-RAILWAY-URL/api/auth/callback` — for production (e.g. `https://xxx.up.railway.app/api/auth/callback`)
4. Save

---

## Switch to Local

### 1. Server (backend)

```bash
cd server

# Create .env.local from template (first time only)
npm run env:local

# Edit .env.local with your actual Google credentials
# (Copy GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from your working .env)
```

**What `.env.local` does:**
- `BACKEND_PUBLIC_URL=http://localhost:3001` → OAuth redirects to local backend
- `FRONTEND_URL=http://localhost:5173` → CORS and post-login redirect

The server auto-loads `.env.local` when `NODE_ENV !== production`, overriding `.env`.

### 2. Webapp (frontend)

```bash
cd webapp

# Create .env.local from template (first time only)
# Copy .env.local.example to .env.local
# Or create .env.local with:
```

```env
VITE_API_URL=http://localhost:3001/api
```

Vite automatically loads `.env.local` in dev mode.

### 3. Run

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd webapp && npm run dev
```

---

## Switch to Production

Production uses **Railway** and **Vercel** env vars — no local switch needed.

- **Railway**: Set `BACKEND_PUBLIC_URL`, `FRONTEND_URL`, `GOOGLE_*`, etc. in dashboard
- **Vercel**: Set `VITE_API_URL` to your Railway API URL (e.g. `https://xxx.up.railway.app/api`)

To see production values:

```bash
cd server
npm run env:prod
```

---

## Quick Reference

| Env file        | When used     | Purpose                          |
|-----------------|---------------|----------------------------------|
| `server/.env`   | Base / prod   | Default values                   |
| `server/.env.local` | Local dev  | Overrides for local testing      |
| `webapp/.env.local` | Local dev  | VITE_API_URL for local backend   |

**Rule:** To test locally, ensure `server/.env.local` exists with local URLs. Delete or rename it if you want to use `.env` only (e.g. production values).
