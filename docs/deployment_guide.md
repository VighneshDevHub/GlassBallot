# GlassBallot: 100% Free Production Deployment Guide

This guide walks you through deploying **GlassBallot** completely **free** using:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 14, global CDN, zero-configuration)
- **Backend**: [Render](https://render.com) (FastAPI Python 3 Web Service, free 750 hrs/month)
- **Database**: [Neon.tech](https://neon.tech) (Serverless PostgreSQL, free tier forever with 0.5 GB storage)
- **Redis (Optional)**: [Upstash](https://upstash.com) (Serverless Redis, 10,000 commands/day free) or built-in in-memory fallback

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │                 Vercel (Free)                 │
                      │               Next.js 14 Frontend             │
                      │          https://glassballot.vercel.app       │
                      └──────────────────────┬────────────────────────┘
                                             │
                        Rewrites /api/* via next.config.js
                        (No CORS or cross-site cookie issues)
                                             │
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │                 Render (Free)                 │
                      │              FastAPI Python Backend           │
                      │       https://glassballot-backend.onrender.com│
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
                                     ▼                 ▼
             ┌───────────────────────────────┐  ┌─────────────────────┐
             │       Neon.tech (Free)        │  │   Upstash (Free)    │
             │     Serverless PostgreSQL     │  │   Redis Cache /     │
             │   (Free forever, 0.5 GB)      │  │   Rate Limiter      │
             └───────────────────────────────┘  └─────────────────────┘
```

---

## Step 1: Create Free PostgreSQL Database on Neon

1. Sign up for free at [neon.tech](https://neon.tech).
2. Click **New Project** and name it `glassballot`.
3. Select your preferred region (e.g., `US East (Ohio)` or `Frankfurt`).
4. Once created, go to the **Dashboard** and copy the **Connection string**. It will look like:
   ```text
   postgres://username:password@ep-cool-sample-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. *(Optional)* You can also use Render's built-in PostgreSQL, but Neon's free tier never expires, whereas Render's free PostgreSQL expires after 30 days.

> [!NOTE]
> GlassBallot's database engine automatically normalizes `postgres://` or `postgresql://` connection strings to `postgresql+asyncpg://`, so you can paste the exact Neon connection string directly!

---

## Step 2: Deploy Backend on Render

You can deploy using either the **Web Dashboard** or the included **`render.yaml` Blueprint**.

### Method A: Render Web Dashboard (Recommended)

1. Sign up / Log in to [render.com](https://render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `VighneshDevHub/GlassBallot`.
4. Configure the service settings:
   - **Name**: `glassballot-backend`
   - **Region**: Same or closest to your database (e.g. `Oregon (US West)` or `Frankfurt`)
   - **Branch**: `main`
   - **Root Directory**: *(Leave blank)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend
     ```
   - **Instance Type**: `Free`
5. Click **Advanced** > **Add Environment Variable** and add the following:

   | Key | Value | Notes |
   |---|---|---|
   | `PYTHONPATH` | `backend:.` | Ensures both `backend/app` and `gb` packages resolve |
   | `DATABASE_URL` | `postgres://...` | Paste your Neon PostgreSQL connection string from Step 1 |
   | `SECRET_KEY` | *(Click "Generate" or random 32 chars)* | For token and HMAC signing |
   | `SESSION_SECRET` | *(Click "Generate" or random 32 chars)* | For admin session cookies |
   | `APP_ENV` | `production` | Production mode |
   | `DEBUG` | `false` | Disable debug stack traces |
   | `DEMO_MODE` | `true` | Enables mock voters and attack simulation controls |
   | `OTP_PROVIDER` | `development` | In-memory demo OTP code generator |
   | `CORS_ORIGINS` | `http://localhost:3000` | We will add the Vercel URL in Step 4 |

6. Click **Create Web Service**.
7. Wait 2–3 minutes for the build to finish. Once live, test the endpoint:
   ```text
   https://<your-backend-name>.onrender.com/health/live
   ```
   You should receive: `{"status":"ok"}`.

---

## Step 3: Deploy Frontend on Vercel

1. Sign up / Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository: `VighneshDevHub/GlassBallot`.
4. On the **Configure Project** screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit**, select `frontend`, and click **Continue**. *(CRITICAL)*
   - **Build Command**: Default (`next build`)
   - **Output Directory**: Default (`.next`)
5. Under **Environment Variables**, add:

   | Key | Value | Notes |
   |---|---|---|
   | `BACKEND_URL` | `https://<your-backend-name>.onrender.com` | Your live Render backend URL from Step 2 |
   | `NEXT_PUBLIC_APP_ENV` | `production` | Environment name |

6. Click **Deploy**.
7. In about 1 minute, Vercel will complete the build and assign you a domain like:
   ```text
   https://glassballot-xxxx.vercel.app
   ```

> [!TIP]
> **Why this setup works without CORS or cookie issues:**
> Next.js uses server-side rewrites in `frontend/next.config.js` to proxy `/api/*` and `/health/*` requests directly to your Render backend. The browser communicates only with your Vercel domain, preserving same-origin security and avoiding third-party cookie restrictions.

---

## Step 4: Add Vercel URL to Render CORS

Now that your Vercel frontend is live:
1. Copy your Vercel URL (e.g. `https://glassballot-xxxx.vercel.app`).
2. Go to your Render Dashboard > `glassballot-backend` > **Environment**.
3. Update `CORS_ORIGINS`:
   ```text
   https://glassballot-xxxx.vercel.app,http://localhost:3000
   ```
4. Click **Save Changes**. Render will automatically apply the change.

---

## Step 5: (Optional) Free Redis on Upstash

GlassBallot automatically falls back to an in-memory rate limiter if Redis is not provided. If you want multi-process persistent rate limiting:

1. Sign up at [upstash.com](https://upstash.com).
2. Create a **Free Redis Database**.
3. Copy the **Redis URL** (`rediss://default:xxxx@xxxx.upstash.io:6379`).
4. In Render > `glassballot-backend` > **Environment**, add:
   ```text
   REDIS_URL=rediss://default:xxxx@xxxx.upstash.io:6379
   ```

---

## Step 6: Preventing Render Free-Tier Cold Starts

Render's free tier spins down web services after 15 minutes of inactivity, causing a 30–50 second cold start on the next request.

To keep it always warm 24/7 completely free:
1. Go to [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com) (both 100% free).
2. Create a monitor/job:
   - **URL**: `https://<your-backend-name>.onrender.com/health/live`
   - **Interval**: Every 10 or 14 minutes.
3. This prevents Render from putting your backend to sleep!

---

## Verification & First Run

1. Open your Vercel URL: `https://glassballot-xxxx.vercel.app`.
2. Browse the **Live Election Landing Page**.
3. Head to `/vote`:
   - Enter mock student credentials (e.g., external ID: `STU-2026-0001`).
   - Request demo OTP.
   - Choose candidate and click **Seal Ballot** (runs WebCrypto ChaCha20-Poly1305 / ECIES client-side).
   - Cast ballot and view your cryptographic **Proof Card**.
4. Check the **Public Verifier** (`/verify/[id]`):
   - Confirms inclusion in the RFC 6962 Merkle tree.
5. Access the **Admin Dashboard** (`/admin/login`):
   - Super admin username: `admin`
   - Default password: `ChangeMe123!`
   - Inspect ledger consistency, witness node sticky alarms, and demo attack simulations.
