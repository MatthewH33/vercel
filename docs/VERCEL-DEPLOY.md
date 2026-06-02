# Deploy AGSV Fantasy to Vercel

## Prerequisites

- MongoDB Atlas working locally (`npm run test:mongo` → OK)
- Data migrated (`npm run migrate:mongo`)
- GitHub account (recommended)

## 1. Push to GitHub

Do **not** commit `.env`.

```bash
git init
git add .
git commit -m "Prepare for Vercel deployment"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 2. Import on Vercel

1. [vercel.com/new](https://vercel.com/new) → import your repo.
2. Framework: **Other** (static + serverless API).
3. Root directory: project root (where `vercel.json` is).

## 3. Environment variables

**Project → Settings → Environment Variables** (Production, Preview, Development):

| Name | Value |
|------|--------|
| `MONGODB_URI` | Same as local `.env` |
| `SESSION_SECRET` | Same as local `.env` |
| `NODE_ENV` | `production` |

## 4. MongoDB Atlas network

**Network Access** → allow **0.0.0.0/0** (required for Vercel serverless).

## 5. Deploy

Click **Deploy**. Your site will be at `https://your-project.vercel.app`.

- HTML/CSS/JS: served from the CDN.
- `/api/*`: serverless function (`api/[...path].js`) → MongoDB Atlas.

## 6. Verify

1. Open your Vercel URL.
2. Register / sign in.
3. Place a test bet.
4. Atlas → **Browse Collections** → `agsv` → confirm new data.

## Local vs Vercel

| | Local `npm start` | Vercel |
|--|-------------------|--------|
| Frontend | Node serves static files | Vercel CDN |
| API | Same `lib/handler.js` | `api/[...path].js` |
| Data | MongoDB Atlas | MongoDB Atlas |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API 500 | Check Vercel **Functions** logs; confirm env vars |
| Sign-in doesn’t stick | `SESSION_SECRET` set; `NODE_ENV=production` |
| MongoDB errors | `MONGODB_URI` correct; Atlas allows `0.0.0.0/0` |
| Empty sports/users | Run `npm run migrate:mongo` against production URI once |

## Redeploy after changes

Push to GitHub — Vercel redeploys automatically.
