# AnalyzeHive Dashboard

AnalyzeHive is an enterprise analytics/operations dashboard ("Ent-OS") covering commercial auditing, supply-chain planning, market intelligence, live map operations, and data ingestion. It is a three-service system: a Next.js frontend, an Express API gateway, and a FastAPI GPU-inference service.

> **Project status: prototype.** The backend and inference services are functional scaffolds with real network wiring end-to-end, but auth and inference logic are mocked (see [Implementation status](#implementation-status)).

---

## Table of contents

- [Architecture](#architecture)
- [Data flow](#data-flow)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Frontend](#frontend)
- [Backend (Express API gateway)](#backend-express-api-gateway)
- [Inference service (FastAPI)](#inference-service-fastapi)
- [API reference](#api-reference)
- [Authentication flow](#authentication-flow)
- [Implementation status](#implementation-status)
- [Deploying to Vercel](#deploying-to-vercel)
- [Known gotchas](#known-gotchas)
- [Target deployment hardware](#target-deployment-hardware)

---

## Architecture

```
┌──────────────────────┐      HTTP (JSON)      ┌───────────────────────┐      HTTP (JSON)      ┌─────────────────────────┐
│  frontend/            │ ───────────────────▶ │  backend/              │ ───────────────────▶ │  inference/              │
│  Next.js 16 (App      │  :8000                │  Express + TypeScript  │  :8001 (internal      │  FastAPI + Python        │
│  Router), React 19     │ ◀─────────────────── │  API gateway           │  only)  ◀──────────── │  GPU inference service   │
│  Browser / SSR         │                       │  auth, business logic  │                       │  model load + /predict   │
└──────────────────────┘                        └───────────────────────┘                       └─────────────────────────┘
```

- **`frontend/`** — the only service end users (and browsers) talk to directly. Renders every page/route, calls the Express API for all data, and never talks to the inference service directly.
- **`backend/`** — the single API gateway. Owns auth, business logic, and routing for every dashboard feature. Proxies inference requests to FastAPI rather than doing any GPU work itself.
- **`inference/`** — an isolated, long-lived process dedicated to GPU-bound work (model loading/inference). Kept separate from Express specifically so a model can stay resident in VRAM instead of being reloaded per request, and so GPU memory isn't duplicated across multiple Node/API workers. Not reachable from the browser — only Express calls it, over `localhost`.

This split (thin stateless gateway + one long-lived GPU process) is the core architectural decision in this repo: it lets the API layer scale/restart independently of the expensive-to-initialize inference process.

## Data flow

1. **Browser → Next.js**: user loads a route (e.g. `/market-radar`). The Next.js proxy (`frontend/src/proxy.ts` — Next.js 16's replacement for `middleware.ts`) checks the `auth_token` cookie; unauthenticated requests to any non-`/login` route are redirected to `/login` with a `callbackUrl`.
2. **Next.js → Express**: client components call the shared `api` client (`frontend/src/lib/api.ts`), which fetches `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) with a `Bearer <token>` header sourced from `localStorage`.
3. **Express**: decodes the bearer token (stateless base64 payload, prototype-only — no signature), executes the route's business logic, and responds with JSON matching the shapes the frontend expects.
4. **Express → FastAPI** (inference only): `POST /api/infer` on Express forwards the request body to FastAPI's `POST /predict` and relays the response verbatim; if FastAPI is unreachable, Express returns `502`.
5. **Response → UI**: the frontend updates state from the JSON response — no server-side data fetching/caching layer beyond what's described above; every dashboard page fetches on the client after mount.

Auth token flow specifically: `login()` stores the token in **both** `localStorage` (read by the API client) and a cookie (read by the Next.js proxy) — these are two independent stores kept in sync by `ApiClient.setToken()`/`clearToken()`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router), React 19 |
| Frontend language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts / maps | Recharts, React Simple Maps, d3-scale |
| Icons | lucide-react |
| Backend framework | Express 4 (TypeScript, ESM, run via `tsx`) |
| Inference framework | FastAPI (Python), Pydantic, Uvicorn |
| Package manager | npm (frontend & backend), pip/venv (inference) |

## Repository layout

```
analyzehive-dashboard/
├── frontend/                  Next.js app (App Router)
│   ├── src/
│   │   ├── app/                One directory per route (see Frontend routes below)
│   │   ├── components/         Shared UI + per-feature component folders (dashboard/, ingestion/)
│   │   ├── lib/api.ts           Single fetch client: auth, token storage, generic get/post helpers
│   │   ├── types/               Ambient type declarations (e.g. react-simple-maps)
│   │   └── proxy.ts             Cookie-based route-guard, runs on every non-static request
│   ├── .npmrc                  legacy-peer-deps — required for the Vercel install step to succeed
│   └── vercel.json             Framework preset + security headers
├── backend/                    Express API gateway
│   ├── src/
│   │   ├── app.ts               Builds and exports the Express app (CORS, JSON parsing, routes)
│   │   ├── index.ts             Local/always-on entrypoint: calls listen()
│   │   └── routes/              One router file per feature area (see API reference below)
│   ├── api/index.ts            Vercel serverless entrypoint: exports the app as the handler
│   ├── public/index.html       Static placeholder served at / on the deployed API host
│   └── vercel.json             Routes all paths to the function; 30s max duration
├── inference/                  FastAPI inference service
│   ├── app/main.py              /health and /predict (currently a mock payload)
│   ├── api/index.py            Vercel serverless entrypoint: re-exports the ASGI app
│   ├── public/index.html       Static placeholder served at / on the deployed inference host
│   └── vercel.json             Routes all paths to the function; 60s max duration, 1 GB
├── supabase/migrations/        Reserved for future SQL migrations (empty)
└── brain.md                    Persistent project memory/instructions for AI coding assistants
```

There is no root-level `vercel.json`: each service is its own Vercel project with its own Root Directory — see [Deploying to Vercel](#deploying-to-vercel).

## Getting started

Requires Node.js 20+, npm, and Python 3.11+.

```bash
# 1. Frontend
cd frontend
npm install --legacy-peer-deps   # react-simple-maps has a peer-dep conflict with react@19
cp .env.example .env.local        # optional locally: defaults already point at :8000
npm run dev                       # http://localhost:3000

# 2. Backend (separate terminal)
cd backend
npm install
cp .env.example .env
npm run dev                       # http://localhost:8000

# 3. Inference service (separate terminal)
cd inference
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001   # http://localhost:8001 (internal only)
```

All three must be running for the full app to work end-to-end. The frontend alone will load and let you navigate, but every page's data fetch will fail without the backend; `/api/infer` will additionally fail (502) without the inference service.

Login accepts **any** email/password — see [Implementation status](#implementation-status).

## Environment variables

| Service | Variable | Default | Required on Vercel | Purpose |
|---|---|---|---|---|
| frontend | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | **Yes** | Base URL the browser uses for all API calls |
| backend | `PYTHON_SERVICE_URL` | `http://localhost:8001` | **Yes** | Where Express forwards `/api/infer` requests |
| backend | `CORS_ORIGIN` | *(unset → `*`)* | Recommended | Comma-separated allowlist of frontend origins |
| backend | `PORT` | `8000` | No — ignored | Port Express listens on (local/always-on hosts only) |
| inference | `PORT` | `8001` | No — ignored | Port Uvicorn binds locally (Vercel invokes the ASGI app directly) |

Each service has a `.env.example` documenting its own variables; copy it to `.env` for local dev. On Vercel these are set per-project under **Settings → Environment Variables** instead — `.env` files are not deployed.

Two of these are easy to get wrong:

- **`NEXT_PUBLIC_API_URL` is baked into the client bundle at build time**, not read at runtime. Changing it in the Vercel dashboard requires a **redeploy** to take effect. If it is left unset in production the built bundle points at `http://localhost:8000` and every dashboard fetch fails in the visitor's browser.
- **`CORS_ORIGIN` left unset means `*`.** That is fine for this prototype only because no endpoint depends on cookie credentials — the token travels in an `Authorization` header. Set it to the frontend's real origin before this carries anything sensitive.

## Frontend

App Router pages (`frontend/src/app/*/page.tsx`), all wrapped in `AppShell` (`Sidebar` + `TopNav`) via the root `layout.tsx`, except `/login` and `/register`:

| Route | Purpose |
|---|---|
| `/` | Main dashboard — stat cards, inventory chart, critical alerts, active batches table |
| `/commercial-truth` | Rep/region hierarchy audit — region filter, per-rep audit log |
| `/supply-chain-physics` | Redistribution planning — cost-per-unit settings, watchlist, redistribution plan |
| `/market-radar` | Market signal search + per-node "full analysis," social feed |
| `/live-operations` | Live world map (`WorldMap` component, zoomable) |
| `/data-connection` | CSV ingestion: upload → column mapping → confirm → preview |
| `/system-status` | Service health + incident list, manual refresh |
| `/profile` | Activity history, change-password form, logout |
| `/login`, `/register` | Unauthenticated auth pages |

Route protection is enforced by `frontend/src/proxy.ts`: any request without an `auth_token` cookie is redirected to `/login?callbackUrl=<original path>`; API routes, static assets, and `/login` itself are excluded from the check.

Key shared modules:
- `frontend/src/lib/api.ts` — the only place that talks to the backend. Wraps `fetch` with base URL, JSON headers, bearer-token injection, and error unwrapping; exposes `login`, `logout`, `getCurrentUser`, `verifyToken`, plus generic `get`/`post` helpers used by feature pages.
- `frontend/src/components/AppShell.tsx` — persistent layout (sidebar + top nav) around every authenticated page.
- Floating UI (modals/dropdowns) is rendered via `createPortal(..., document.body)` rather than in-tree `fixed`/`absolute` positioning — required because some pages use CSS `perspective`/`transform` animations that create stacking contexts, which broke naively-positioned overlays. Any new modal/dropdown should follow the same pattern.

## Backend (Express API gateway)

`backend/src/app.ts` wires CORS, JSON body parsing, and one router per feature area under `/api/*`, and exports the configured Express app. Two thin entrypoints import it: `backend/src/index.ts` calls `listen()` for local dev / any always-on host, and `backend/api/index.ts` exports the app directly as a Vercel serverless function. Everything is in-memory (no database) — state resets on restart, and on Vercel it resets between invocations.

## Inference service (FastAPI)

`inference/app/main.py` exposes `GET /health` and `POST /predict`. Not reachable from the browser; only `backend`'s `/api/infer` route calls it, over `localhost`, on port `8001`.

## API reference

All routes are mounted under `http://localhost:8000` by the backend.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Backend liveness check |
| POST | `/api/auth/login` | Body: `{ email, password }`. Any credentials succeed (mock). Returns `{ access_token, token_type, user }` |
| GET | `/api/auth/me` | Requires `Authorization: Bearer <token>`. Returns the session's user |
| POST | `/api/auth/change-password` | Requires auth. Body: `{ currentPassword, newPassword }` (min 8 chars). Prototype: doesn't persist |
| POST | `/api/auth/forgot-password` | Body: `{ email }`. Prototype: no real email sent |
| POST | `/api/infer` | Proxies to FastAPI `POST /predict`; `502` if inference service is down |
| GET | `/api/alerts` | List critical alerts |
| GET | `/api/alerts/:id` | Alert detail |
| GET | `/api/notifications` | List notifications |
| POST | `/api/notifications/:id/read` | Mark a notification read |
| GET | `/api/market-radar/signals?q=` | Search market signals |
| GET | `/api/market-radar/nodes/:id/analysis` | Full analysis for a node |
| GET | `/api/commercial-truth/hierarchy?region=` | Rep/region hierarchy, optionally filtered |
| GET | `/api/commercial-truth/audit/:id/log` | Per-rep audit trail |
| GET | `/api/profile/activity?limit=` | Activity history |
| GET | `/api/system-status/services` | Service health list |
| GET | `/api/system-status/incidents` | Incident list |
| GET | `/api/supply-chain/watchlist` | Full watchlist |
| GET | `/api/supply-chain/plan` | Redistribution plan |
| POST | `/api/ingestion/upload` | Body: `{ columns: string[], rows: any[] }`. Returns `{ id, receivedRows, receivedColumns, receivedAt }` |

FastAPI (`http://localhost:8001`, internal only):

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Inference service liveness check |
| POST | `/predict` | Body: `{ input?: dict }`. Returns mock `{ result, model }` |

## Authentication flow

1. User submits the login form → `api.login(email, password)` → `POST /api/auth/login`.
2. Express accepts **any** email (password is ignored), fabricates a user record, and returns it alongside a token that is just the user record base64url-encoded behind a `mock.` prefix — **stateless and unsigned**. It is stateless deliberately: on Vercel each invocation can land on a fresh instance, so an in-process session `Map` would drop sessions between requests.
3. The frontend stores the token in `localStorage` (`auth_token`, `user`) **and** as a cookie (`auth_token`, `SameSite=Lax`, 1-day max-age) — the cookie is what `proxy.ts` checks server-side; `localStorage` is what `ApiClient` reads for the `Authorization` header on every subsequent request.
4. Reloading a page re-validates via `GET /api/auth/me` (`verifyToken()`), which Express answers by decoding the bearer token — no server-side lookup involved.
5. Logout clears both stores client-side (`api.logout()`); there is no server-side session revocation endpoint.

This is a real network contract end-to-end but not real security — see below.

## Implementation status

Both `backend/` and `inference/` are **prototype scaffolds**, not production services:

- **No database.** All state (uploaded data acknowledgements, notification read-flags, etc.) lives in in-memory JS objects and is lost on restart — and on Vercel, between invocations.
- **No real auth.** Any email/password combination logs in successfully; the token is an unsigned base64 blob that anyone can forge, not a real per-user JWT.
- **No real inference.** FastAPI's `/predict` returns a hardcoded mock payload — no PyTorch/TensorRT model is loaded.
- **CSV ingestion doesn't persist data** — `/api/ingestion/upload` just acknowledges row/column counts.

Suggested upgrade path when real infrastructure is available:
1. Replace the unsigned mock token with real user storage + signed JWT verification (the `encodeToken`/`decodeToken` pair in `backend/src/routes/auth.ts` is the seam).
2. Keep FastAPI's `/predict` request/response contract stable; swap the mock body for real PyTorch/TensorRT calls once a model and GPU are available.
3. Only introduce something like NVIDIA Triton Inference Server if/when serving multiple models across multiple GPUs is actually needed — premature before then.

## Deploying to Vercel

This repo deploys as **three separate Vercel projects from the same Git repository**, each with a different **Root Directory**. Vercel builds one project per root, so a push to `main` triggers all three independently.

| Vercel project | Root Directory | Framework preset | Serves |
|---|---|---|---|
| `analyzehive-frontend` | `frontend` | Next.js (auto-detected) | The dashboard UI — the only public-facing project |
| `analyzehive-backend` | `backend` | Other | Express API as one serverless function |
| `analyzehive-inference` | `inference` | Other | FastAPI as one Python serverless function |

### How each service is adapted

The two API services are long-running processes locally but serverless functions on Vercel. Both keep a single shared app definition and two entrypoints, so local dev and production run identical code:

- **backend** — `src/app.ts` builds and exports the Express app. `src/index.ts` calls `listen()` locally; `api/index.ts` exports the app directly (an Express app *is* a `(req, res)` handler, so Vercel can invoke it as-is). `vercel.json` rewrites every path to `/api`, and Express routes off the original URL.
- **inference** — `app/main.py` defines the FastAPI app. Uvicorn serves it locally; `api/index.py` re-exports it as a module-level `app`, which Vercel's Python runtime detects and serves as ASGI directly — **no uvicorn process runs in production**.
- Both projects also ship a static `public/index.html` placeholder. Because Vercel checks the filesystem before applying rewrites, `/` serves that page while every other path reaches the function.

### Deploy order

Each service needs the previous one's URL, so deploy back-to-front. Import the repo three times at [vercel.com/new](https://vercel.com/new), setting **Root Directory** as above:

1. **`inference`** first — it depends on nothing. Note its assigned URL.
2. **`backend`** — set `PYTHON_SERVICE_URL` to the inference URL from step 1. Note its URL.
3. **`frontend`** — set `NEXT_PUBLIC_API_URL` to the backend URL from step 2.
4. Go back to **`backend`** and set `CORS_ORIGIN` to the frontend URL from step 3, then redeploy it.

Verify with:

```bash
curl https://<inference-url>/health                     # {"status":"ok",...}
curl https://<backend-url>/api/health                   # {"status":"ok",...}
curl -X POST https://<backend-url>/api/infer \
  -H 'Content-Type: application/json' -d '{"input":{}}' # proves backend → inference wiring
```

If the last call returns `502 Inference service unavailable`, `PYTHON_SERVICE_URL` is wrong or missing on the backend project.

### Things to know before relying on this

- **No GPU on Vercel.** Vercel's Python functions are CPU-only, so the inference service deploys today *only because `/predict` returns a mock*. Real PyTorch/TensorRT work cannot run here — that is what the [target deployment hardware](#target-deployment-hardware) is for. Vercel is appropriate for the frontend and gateway; the inference service will need to move to a GPU host, at which point only `PYTHON_SERVICE_URL` has to change.
- **In-memory state does not survive.** Writes like `POST /api/notifications/:id/read` mutate a module-level array. Each invocation may hit a fresh instance, so those writes are effectively discarded. This is a prototype limitation, not a Vercel one — it needs a database either way.
- **Preview deployments get fresh URLs.** Because `NEXT_PUBLIC_API_URL` is build-time, a preview frontend still points at whatever backend URL was configured for that environment. Set the env vars per-environment (Production / Preview) if you want previews wired to a separate backend.
- **`npm install` on the frontend needs `legacy-peer-deps`.** `frontend/.npmrc` sets this, which is what makes Vercel's install step succeed — see [Known gotchas](#known-gotchas).

### Deploying from the CLI

```bash
npm i -g vercel
cd frontend && vercel --prod    # repeat per service directory
```

## Known gotchas

- **Port 8000 squatters**: if the backend won't bind to `:8000` or login fails with a confusing CORS error, run `lsof -i :8000` before assuming it's a code bug — an unrelated local process can silently occupy the port and eat the backend's traffic.
- **Peer dependency conflicts**: `react-simple-maps@3` declares a peer range topping out at React 18 and has no React 19 release, so a strict install fails outright. The library works fine against React 19 — only its metadata is stale. Locally, install frontend deps with `npm install --legacy-peer-deps`; on Vercel this is handled by `frontend/.npmrc` (`legacy-peer-deps=true`), **without which the production build fails before it starts**. Don't delete that file.
- **Floating UI stacking contexts**: pages using `.perspective-container` or `animate-fade-in-up` create CSS stacking contexts that break naively-positioned `fixed`/`absolute` overlays regardless of z-index. Modals/dropdowns must render via `createPortal(..., document.body)`.

## Target deployment hardware

The intended production deployment target is a **Corespan PRU 2500** — a photonic-interconnect PCIe Gen5 chassis (up to 3.2 Tbps fabric) housing up to 12 standard PCIe devices, including double-width GPUs. The "photonic" part is the interconnect fabric only; actual compute comes from whatever standard GPUs are installed, so the software stack targets standard CUDA/GPU tooling, not anything photonic-specific. No SDK/API for the fabric management layer is publicly documented — that would need to come from Corespan directly before building any hot-swap/attach-detach device orchestration against it.
