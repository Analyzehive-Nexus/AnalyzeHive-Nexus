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

1. **Browser → Next.js**: user loads a route (e.g. `/market-radar`). Next.js middleware (`frontend/src/middleware.ts`) checks the `auth_token` cookie; unauthenticated requests to any non-`/login` route are redirected to `/login` with a `callbackUrl`.
2. **Next.js → Express**: client components call the shared `api` client (`frontend/src/lib/api.ts`), which fetches `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) with a `Bearer <token>` header sourced from `localStorage`.
3. **Express**: validates/looks up the session (in-memory `Map`, prototype-only), executes the route's business logic, and responds with JSON matching the shapes the frontend expects.
4. **Express → FastAPI** (inference only): `POST /api/infer` on Express forwards the request body to FastAPI's `POST /predict` and relays the response verbatim; if FastAPI is unreachable, Express returns `502`.
5. **Response → UI**: the frontend updates state from the JSON response — no server-side data fetching/caching layer beyond what's described above; every dashboard page fetches on the client after mount.

Auth token flow specifically: `login()` stores the token in **both** `localStorage` (read by the API client) and a cookie (read by the Next.js middleware) — these are two independent stores kept in sync by `ApiClient.setToken()`/`clearToken()`.

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
│   └── src/
│       ├── app/                One directory per route (see Frontend routes below)
│       ├── components/         Shared UI + per-feature component folders (dashboard/, ingestion/)
│       ├── lib/api.ts           Single fetch client: auth, token storage, generic get/post helpers
│       ├── types/                Ambient type declarations (e.g. react-simple-maps)
│       └── middleware.ts        Cookie-based route-guard, runs on every non-static request
├── backend/                    Express API gateway
│   └── src/
│       ├── index.ts             App bootstrap: CORS, JSON body parsing, route mounting
│       └── routes/               One router file per feature area (see API reference below)
├── inference/                  FastAPI inference service
│   └── app/main.py               /health and /predict (currently a mock payload)
└── brain.md                    Persistent project memory/instructions for AI coding assistants
```

## Getting started

Requires Node.js 20+, npm, and Python 3.11+.

```bash
# 1. Frontend
cd frontend
npm install --legacy-peer-deps   # react-simple-maps has a peer-dep conflict with react@19
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

| Service | Variable | Default | Purpose |
|---|---|---|---|
| frontend | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL the browser uses for all API calls |
| backend | `PORT` | `8000` | Port Express listens on |
| backend | `PYTHON_SERVICE_URL` | `http://localhost:8001` | Where Express forwards `/api/infer` requests |
| inference | `PORT` | `8001` | Port Uvicorn listens on |

The frontend has no `.env` file today (`NEXT_PUBLIC_API_URL` isn't overridden anywhere); set one only if you need to point the UI at a non-default backend URL.

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

Route protection is enforced by `frontend/src/middleware.ts`: any request without an `auth_token` cookie is redirected to `/login?callbackUrl=<original path>`; API routes, static assets, and `/login` itself are excluded from the check.

Key shared modules:
- `frontend/src/lib/api.ts` — the only place that talks to the backend. Wraps `fetch` with base URL, JSON headers, bearer-token injection, and error unwrapping; exposes `login`, `logout`, `getCurrentUser`, `verifyToken`, plus generic `get`/`post` helpers used by feature pages.
- `frontend/src/components/AppShell.tsx` — persistent layout (sidebar + top nav) around every authenticated page.
- Floating UI (modals/dropdowns) is rendered via `createPortal(..., document.body)` rather than in-tree `fixed`/`absolute` positioning — required because some pages use CSS `perspective`/`transform` animations that create stacking contexts, which broke naively-positioned overlays. Any new modal/dropdown should follow the same pattern.

## Backend (Express API gateway)

`backend/src/index.ts` wires CORS, JSON body parsing, and one router per feature area under `/api/*`. Everything is in-memory (no database) — state resets on restart.

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
2. Express accepts **any** email (password is ignored), fabricates a user record, stores it in an in-memory `Map<token, user>` keyed by a **static** mock token, and returns it.
3. The frontend stores the token in `localStorage` (`auth_token`, `user`) **and** as a cookie (`auth_token`, `SameSite=Lax`, 1-day max-age) — the cookie is what `middleware.ts` checks server-side; `localStorage` is what `ApiClient` reads for the `Authorization` header on every subsequent request.
4. Reloading a page re-validates via `GET /api/auth/me` (`verifyToken()`), which Express answers by looking up the bearer token in the same in-memory `Map`.
5. Logout clears both stores client-side (`api.logout()`); there is no server-side session revocation endpoint.

This is a real network contract end-to-end but not real security — see below.

## Implementation status

Both `backend/` and `inference/` are **prototype scaffolds**, not production services:

- **No database.** All state (sessions, uploaded data acknowledgements, etc.) lives in in-memory JS objects/Maps and is lost on restart.
- **No real auth.** Any email/password combination logs in successfully; the session token is a single hardcoded string shared by all logged-in users, not a real per-user JWT.
- **No real inference.** FastAPI's `/predict` returns a hardcoded mock payload — no PyTorch/TensorRT model is loaded.
- **CSV ingestion doesn't persist data** — `/api/ingestion/upload` just acknowledges row/column counts.

Suggested upgrade path when real infrastructure is available:
1. Replace the in-memory session `Map` with real user storage + JWT verification.
2. Keep FastAPI's `/predict` request/response contract stable; swap the mock body for real PyTorch/TensorRT calls once a model and GPU are available.
3. Only introduce something like NVIDIA Triton Inference Server if/when serving multiple models across multiple GPUs is actually needed — premature before then.

## Known gotchas

- **Port 8000 squatters**: if the backend won't bind to `:8000` or login fails with a confusing CORS error, run `lsof -i :8000` before assuming it's a code bug — an unrelated local process can silently occupy the port and eat the backend's traffic.
- **Peer dependency conflicts**: `react-simple-maps` conflicts with `react@19`; always install frontend deps with `npm install --legacy-peer-deps`.
- **Floating UI stacking contexts**: pages using `.perspective-container` or `animate-fade-in-up` create CSS stacking contexts that break naively-positioned `fixed`/`absolute` overlays regardless of z-index. Modals/dropdowns must render via `createPortal(..., document.body)`.

## Target deployment hardware

The intended production deployment target is a **Corespan PRU 2500** — a photonic-interconnect PCIe Gen5 chassis (up to 3.2 Tbps fabric) housing up to 12 standard PCIe devices, including double-width GPUs. The "photonic" part is the interconnect fabric only; actual compute comes from whatever standard GPUs are installed, so the software stack targets standard CUDA/GPU tooling, not anything photonic-specific. No SDK/API for the fabric management layer is publicly documented — that would need to come from Corespan directly before building any hot-swap/attach-detach device orchestration against it.
