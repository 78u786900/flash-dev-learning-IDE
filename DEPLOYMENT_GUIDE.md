# flash.dev Deployment Guide

Complete guide for deploying flash.dev as a full-stack web application with Google OAuth and Google Drive storage.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud Console Setup](#google-cloud-console-setup)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** or **yarn**
- **Google Account** for Google Cloud Console access
- **Domain name** (for production deployment)

---

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., `flash-dev-production`)
4. Click **Create**

### Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - **Google Drive API**
   - **Google People API** (for OAuth user info)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (or Internal for Google Workspace)
3. Fill in required fields:
   - **App name**: `flash.dev`
   - **User support email**: Your email
   - **App logo**: (optional)
   - **App domain**: Your production domain (if applicable)
   - **Developer contact email**: Your email
4. Click **Save and Continue**

#### Add Scopes
1. Click **Add or Remove Scopes**
2. Add these scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.file`
3. Click **Update** → **Save and Continue**

#### Add Test Users (for development)
1. Add your email as a test user
2. Click **Save and Continue** → **Back to Dashboard**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Name it (e.g., `flash.dev Web Client`)
5. Add **Authorized JavaScript origins**:
   - For development: `http://localhost:5173`
   - For production: `https://your-domain.com`
6. Add **Authorized redirect URIs**:
   - For development: `http://localhost:5173/api/auth/callback`
   - For production: `https://your-domain.com/api/auth/callback`
7. Click **Create**
8. **Copy** the `Client ID` and `Client Secret`

---

## Local Development Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to project root
cd learning_IDE

# Install frontend dependencies
cd webapp
npm install

# Install backend dependencies
cd ../server
npm install
```

### Step 2: Configure Environment Variables

#### Backend (.env)

Create `server/.env`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:5173

# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Session secret (generate a random string)
SESSION_SECRET=your-random-session-secret-at-least-32-chars

# JWT Secret for token signing
JWT_SECRET=your-random-jwt-secret-at-least-32-chars

# Google Drive app folder name
DRIVE_FOLDER_NAME=flash.dev
```

#### Frontend (.env)

Update `webapp/.env`:

```env
# Gemini API key (required for Agent / Ask mode)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Backend API URL
VITE_API_URL=http://localhost:3001/api
```

### Step 3: Start Development Servers

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd webapp
npm run dev
```

### Step 4: Test the Application

1. Open `http://localhost:5173`
2. Click **"以 Google 登入"** (Login with Google)
3. Complete Google OAuth flow
4. Verify that:
   - User info appears in header
   - Notes are saved to Google Drive (check the `flash.dev` folder)

---

## Production Deployment

### Option A: Deploy to Vercel + Railway/Render

#### Frontend (Vercel)

1. Push code to GitHub
2. Connect to Vercel
3. Set root directory to `webapp`
4. Add environment variables:
   - `VITE_GEMINI_API_KEY`
   - `VITE_API_URL` (your backend URL)
5. Deploy

#### Backend (Railway/Render)

1. Connect to Railway or Render
2. Set root directory to `server`
3. Add environment variables (see reference below)
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Deploy

### Option B: Deploy to Single VPS

#### Using Docker Compose

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./webapp
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=https://api.your-domain.com

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - FRONTEND_URL=https://your-domain.com
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - DRIVE_FOLDER_NAME=flash.dev
```

Create `webapp/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `webapp/nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Create `server/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

#### Deploy Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option C: Deploy to Google Cloud Run

#### Backend (Cloud Run)

```bash
# Build and push image
cd server
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/flash-dev-server

# Deploy
gcloud run deploy flash-dev-server \
  --image gcr.io/YOUR_PROJECT_ID/flash-dev-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=https://your-frontend.com,DRIVE_FOLDER_NAME=flash.dev" \
  --set-secrets "GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,SESSION_SECRET=session-secret:latest,JWT_SECRET=jwt-secret:latest"
```

#### Frontend (Firebase Hosting or Cloud Run)

```bash
# Build
cd webapp
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## Environment Variables Reference

### Backend (server/.env)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PORT` | Server port | No (default: 3001) | `3001` |
| `NODE_ENV` | Environment | No | `development` / `production` |
| `FRONTEND_URL` | Frontend URL for CORS | Yes | `https://flash.dev` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Yes | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Yes | `GOCSPX-xxx` |
| `SESSION_SECRET` | Session encryption key | Yes | Random 32+ char string |
| `JWT_SECRET` | JWT signing key | Yes | Random 32+ char string |
| `DRIVE_FOLDER_NAME` | Google Drive folder name | No (default: flash.dev) | `flash.dev` |

### Frontend (webapp/.env)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_GEMINI_API_KEY` | Gemini API key | Yes | `AIzaSy...` |
| `VITE_GEMINI_DEFAULT_MODEL` | Default model | No | `gemini-3-flash` |
| `VITE_API_URL` | Backend API URL | Yes | `https://api.flash.dev/api` |

---

## Troubleshooting

### OAuth Errors

**"redirect_uri_mismatch"**
- Ensure the redirect URI in Google Console matches exactly:
  - Development: `http://localhost:5173/api/auth/callback`
  - Production: `https://your-domain.com/api/auth/callback`

**"access_denied"**
- Make sure your email is added as a test user (for apps in testing mode)
- Or publish the app for production use

### CORS Errors

- Verify `FRONTEND_URL` in backend `.env` matches the frontend URL exactly
- Check that credentials are included in fetch requests

### Google Drive Not Creating Folder

- Verify the `drive.file` scope is enabled in OAuth consent screen
- Check that the user has granted Drive access during login

### Token Expired

- The app should automatically refresh tokens
- If issues persist, clear localStorage and re-login

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               flash.dev Frontend                     │    │
│  │            (Vite + React + TypeScript)               │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   flash.dev Backend                          │
│               (Node.js + Express + TypeScript)               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Auth   │  │    Storage   │  │        Files         │   │
│  │  Routes  │  │    Routes    │  │       Routes         │   │
│  └────┬─────┘  └──────┬───────┘  └──────────┬───────────┘   │
│       │               │                      │               │
│       ▼               ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Google APIs Integration                 │    │
│  │  ┌──────────────┐    ┌──────────────────────────┐   │    │
│  │  │ OAuth 2.0    │    │     Google Drive API      │   │    │
│  │  │ (Login)      │    │ (Storage: notes, files)   │   │    │
│  │  └──────────────┘    └──────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud                              │
│  ┌──────────────────┐    ┌──────────────────────────┐       │
│  │  User's Google   │    │    User's Google Drive    │       │
│  │     Account      │    │  (flash.dev folder)       │       │
│  └──────────────────┘    └──────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use strong secrets** - Generate random strings for SESSION_SECRET and JWT_SECRET
3. **Enable HTTPS** in production
4. **Regularly rotate secrets** in production
5. **Set up Google Cloud audit logging** to monitor OAuth usage

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Google Cloud Console logs
3. Check browser console for frontend errors
4. Check server logs for backend errors

---

*Last updated: February 2026*
