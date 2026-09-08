# AnalyzeHive Dashboard - Brain

This file serves as a persistent, file-based memory layer and instruction manual for AI coding assistants. It captures the project's durable knowledge, long-term context, and operational rules.

## Core Functions
- **Context Persistence**: Retains architectural choices, requirements, and constraints.
- **Agent Alignment**: Standardizes tool behavior so models follow project-specific stack preferences instead of generic defaults.
- **Portable Memory**: Stores institutional knowledge under version control.

## Project Context & Architecture
- **Tech Stack**: Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, Recharts, React Simple Maps.
- **Project Structure**: Three top-level dirs — `frontend/` (Next.js), `backend/` (Express/TypeScript API gateway), `inference/` (FastAPI/Python inference service).
- **Backend Infrastructure**: Target deployment hardware is a Corespan PRU 2500 (`https://www.corespan.ai/products/photonic-resource-unit`) — a photonic-interconnect PCIe Gen5 chassis (up to 3.2 Tbps fabric) housing up to 12 standard PCIe devices including double-width GPUs. The "photonic" part is the interconnect fabric, not the compute itself; actual acceleration comes from whatever GPUs sit in the chassis, so the software stack targets standard CUDA/GPU tooling, not anything photonic-specific. Corespan's page has no published SDK/API docs for the fabric management layer — get those from Corespan before building any hot-swap/attach-detach device orchestration.
- **Backend split**: `backend/` (Express) is the API gateway the frontend talks to — auth, business logic, routing. `inference/` (FastAPI) owns GPU-bound work (model loading/inference) as its own long-lived process so models stay resident in VRAM instead of reloading per request; Express proxies to it rather than touching the GPU itself. This split exists specifically to avoid GPU memory duplication across multiple Node/API workers.
- **Backend status**: Both are prototype scaffolds only — Express uses Express (not Fastify) and FastAPI wraps mock data (not real PyTorch/TensorRT) since there's no real model or hardware access yet. Upgrade path when real GPUs are available: keep FastAPI's `/predict` contract stable, swap the mock body for real PyTorch/TensorRT calls, and only introduce NVIDIA Triton Inference Server once serving multiple models across multiple GPUs actually matters (premature before then).
- **Ports**: Express on `:8000` (matches what `frontend/src/lib/api.ts` already expects), FastAPI on `:8001` (internal only, not called directly by the frontend). **These apply to local dev only** — on Vercel both are serverless functions and `PORT` is ignored entirely.
- **Hosting**: Vercel, as three separate projects from this one repo (Root Directory `frontend/`, `backend/`, `inference/`). This is the *current* host, not a replacement for the Corespan target above — Vercel has no GPU, so it only works while `/predict` is mocked. See Vercel Deployment Log (2026-08-08).

## Current Implementation Details
- **Authentication**: `frontend/src/lib/api.ts` now calls the real `backend/` Express service (`POST /api/auth/login`, `GET /api/auth/me`) instead of mocking client-side. The backend itself still mocks the actual auth logic (any email/password succeeds) — there's no real user DB yet, but the network contract is real end-to-end. As of 2026-08-08 the session store is **no longer an in-memory `Map`**: the token is the user record base64url-encoded behind a `mock.` prefix, unsigned and stateless, because serverless invocations can't share in-process state (see Vercel Deployment Log). `getUser()`/`setUser()`/localStorage caching in `api.ts` is unchanged.
- **NPM Modules**: For package installations, use `--legacy-peer-deps` due to peer dependency conflicts caused by `react@19` (e.g., with `react-simple-maps`).
- **Known environment gotcha**: On 2026-07-26, port 8000 was found occupied by an unrelated stray `php -S localhost:8000 router.php` process (serving out of `~/.Trash/prideluxury`, a forgotten dev server from an old deleted project, alive since 2026-06-25). It silently ate `backend/`'s port and made the frontend's login calls fail with a misleading CORS error (the preflight was actually hitting PHP, not Express). Killed with user confirmation. If `backend/` mysteriously won't bind to `:8000` or login CORS-fails again, check `lsof -i :8000` for squatters before assuming it's a code bug.

## Cleanup Log (2026-07-26)
- Removed duplicate root `frontend/middleware.ts` — Next.js only reads `frontend/src/middleware.ts` since the project uses a `src/` dir; the root copy was dead and slightly out of date (missing the `callbackUrl` param the login page relies on).
- Fixed double `<AppShell>` nesting: `data-connection/page.tsx` and `supply-chain/page.tsx` were wrapping themselves in `<AppShell>` even though `layout.tsx` already wraps every page in it. Both now just return a fragment.
- Deleted the orphaned `/supply-chain` route (`src/app/supply-chain/`) and its only consumer `src/components/redistribution/RedistributionSimulator.tsx`. It was an earlier, unlinked draft superseded by `/supply-chain-physics` (the one in `Sidebar.tsx` nav).
- Deleted unused dead components confirmed via grep (no page ever imported them): `components/dashboard/AnalyticsMap.tsx`, `components/StatusBar.tsx`, `components/SupplyChainPhysicsGraph.tsx`, and the entire `components/commercial-truth/` folder (AuditKPIs, AuditRow, CallTranscriptPanel, HierarchyAuditTable, NLPHighlight — the `commercial-truth` page reimplements this UI inline instead).
- Verified with `npm run build`: compiles clean, only 10 real routes remain. Two pre-existing/unrelated warnings noted but not fixed: Next 16 deprecating `middleware.ts` in favor of `proxy.ts`, and a Recharts container-size warning during static prerendering.

## Scaffold Log (2026-07-26)
- Created `backend/` (Express + TypeScript, ESM, `tsx` for dev): `src/index.ts` bootstraps the app; routes are `GET /api/health`, `POST /api/auth/login` (mock, mirrors `frontend/src/lib/api.ts`'s `LoginResponse`/`ApiUser` shape exactly so it's a drop-in for the frontend's current mocked login), and `POST /api/infer` (proxies to FastAPI's `/predict`, returns 502 if the inference service is down).
- Created `inference/` (FastAPI + Python venv): `app/main.py` has `GET /health` and `POST /predict` returning a mock `{result, model}` payload — no real model loaded yet.
- Verified end-to-end with both services running locally: Express health, FastAPI health, mock login, and the Express→FastAPI `/api/infer` proxy all responded correctly.
- The frontend's `src/lib/api.ts` still mocks login client-side and has **not** been pointed at this new backend — that's a deliberate next step, not done yet, since these are prototype scaffolds.

## Wiring Log (2026-07-26)
- `frontend/src/lib/api.ts`: `login()` now POSTs to `/api/auth/login` (was a hardcoded mock); `verifyToken()` and `getCurrentUser()` now GET `/api/auth/me` (was reading localStorage only). `logout()` unchanged (client-side token clear only — no server session to revoke yet).
- `backend/src/routes/auth.ts`: added `GET /api/auth/me`, backed by an in-memory `Map<token, user>` populated at login. Prototype-only; a real backend will replace this with actual JWT verification.
- Verified end-to-end with Playwright against the real dev servers (not just curl): filled the login form, submitted, confirmed redirect off `/login` to the dashboard, confirmed the session survives a page reload (via `verifyToken`), and confirmed zero console errors. Screenshots matched the dashboard rendering correctly.
- Ran into and resolved the port-8000 PHP squatter issue above during this verification — worth knowing if this flow is retested later and suddenly fails with a CORS error again.

## Full-Functionality Wiring (2026-07-26)
Made every previously-dead UI element across the app actually work, backed by real Express endpoints (not client-side mocking). Full list of new backend routes: `backend/src/routes/alerts.ts` (`GET /api/alerts`, `GET /api/alerts/:id`), `notifications.ts` (`GET /api/notifications`, `POST /api/notifications/:id/read`), `marketRadar.ts` (`GET /api/market-radar/signals?q=`, `GET /api/market-radar/nodes/:id/analysis`), `commercialTruth.ts` (`GET /api/commercial-truth/hierarchy?region=`, `GET /api/commercial-truth/audit/:id/log`), `profile.ts` (`GET /api/profile/activity?limit=`), `systemStatus.ts` (`GET /api/system-status/services`, `GET /api/system-status/incidents`), `supplyChain.ts` (`GET /api/supply-chain/watchlist`, `GET /api/supply-chain/plan`), `ingestion.ts` (`POST /api/ingestion/upload`), plus `auth.ts` additions (`POST /api/auth/change-password`, `POST /api/auth/forgot-password`).

Frontend changes per page/component:
- **Sidebar nav** (`components/Sidebar.tsx`): was missing 4 of 8 real routes (`/live-operations`, `/data-connection`, `/system-status`, `/profile` were only reachable by typing the URL directly). Added all four.
- **TopNav** (`components/TopNav.tsx`): notification bell now opens a real dropdown backed by `/api/notifications`, click-to-mark-read.
- **Dashboard** (`components/dashboard/CriticalAlerts.tsx`): "Investigate" expands real per-alert detail text; "Open alert center" opens a full modal listing all alerts.
- **DataGrid** (`components/DataGrid.tsx`): Previous/1/2/3/Next were inert `<span>`s — now real client-side pagination (5 rows/page), resets to page 1 when the data set changes.
- **Data Connection** (`app/data-connection/page.tsx`): `ColumnMapping.tsx` existed but was never rendered — wired into a real upload → map columns → confirm → `POST /api/ingestion/upload` → preview flow. Also fixed `ColumnMapping`'s `onConfirm` contract, which previously discarded the original CSV column name, making correct remapping impossible.
- **Live Operations** (`app/live-operations/page.tsx`, `components/dashboard/WorldMap.tsx`): map `+`/`-` buttons now actually zoom (`WorldMap` takes a `scale` prop).
- **Market Radar** (`app/market-radar/page.tsx`): signals moved to backend with working search (`?q=`); "Full Analysis" button fetches and shows real per-node analysis; social-feed cards expand full text on click.
- **Commercial Truth** (`app/commercial-truth/page.tsx`): hierarchy data moved to backend; header Filter icon now opens a working region dropdown; "Full Audit Log" fetches and shows a real per-rep audit trail.
- **Profile** (`app/profile/page.tsx`): "View All" loads full activity history; "Update" (Change Password) is a real form hitting `/api/auth/change-password`; the Danger Zone "LOGOUT" button previously did **nothing** (unlike Sidebar's working logout) — now calls `api.logout()` and redirects.
- **System Status** (`app/system-status/page.tsx`): services/incidents moved to backend; refresh button re-fetches with a spinning icon.
- **Supply Chain Physics** (`app/supply-chain-physics/page.tsx`): "Adjust" opens a real settings panel (editable cost-per-unit); "Review Plan" fetches and shows a real redistribution plan; "View Full Watchlist" expands to the full backend list.
- **Login** (`app/login/page.tsx`): "Forgot Key?" now opens a real form hitting `/api/auth/forgot-password`.

**Two real bugs found and fixed during verification** (both pre-existing, exposed by adding the first real dropdowns/modals to this app — worth remembering if new floating UI is added later):
1. `components/AppShell.tsx` gave the `TopNav` wrapper and the page-content wrapper the *same* `z-10`, so DOM order made page content paint over `TopNav`'s dropdown. Fixed by bumping `TopNav`'s wrapper to `z-20`.
2. Several pages use `.perspective-container` (`perspective: 1200px` in `globals.css`), and structural elements use `animate-fade-in-up` (a `transform`-based animation) — both silently create CSS containing blocks/stacking contexts, which broke any `position: fixed` modal or a dropdown nested inside an animated ancestor competing against a later-DOM animated sibling, regardless of the modal's own z-index. Fixed by rendering all floating UI (`CriticalAlerts`' alert-center modal, the Supply Chain Physics plan modal, Commercial Truth's region dropdown) through `createPortal(..., document.body)` instead of relying on in-tree `fixed`/`absolute` + z-index. **Any new modal/dropdown added to this app should use the same portal pattern** — plain `fixed inset-0` nested inside page content is not safe here.

Verified everything with real Playwright browser runs against the actual dev servers (not just curl/build) — filled forms, clicked every button, dragged the region filter, uploaded a real CSV through the full ingestion pipeline, zoomed the map, expanded audit logs, and confirmed each corresponding backend call fired with a 200. `npm run build` and `tsc --noEmit` both clean on frontend and backend after all changes.

## Documentation Log (2026-07-27)
- Wrote a full root `README.md` (previously an empty UTF-16 placeholder) covering architecture, data flow, tech stack, repo layout, setup instructions, env vars, per-route frontend map, full API reference for both backend and inference, the auth flow, prototype-status caveats, and the known gotchas already listed above in this file. Keep it in sync when routes/services change — it duplicates a lot of what's in this file in a user-facing form.

## Layout & Hydration Fixes (2026-07-28)
- **Recurring bug class: missing `min-h-0` on flex/grid items with fixed-height ancestors.** Same root cause hit three places: `commercial-truth`'s Field Force Audit table, `supply-chain-physics`'s Redistribution Simulator/Expiry Watchlist row, and — most importantly — `components/AppShell.tsx` itself (`main` and its page-content `overflow-y-auto` div lacked `min-h-0`). Flex/grid items default to `min-height: auto`, so when a page's content is taller than the viewport, the container just grows past `h-screen` instead of respecting it, the outer `overflow-hidden` wrapper clips the excess, and the intended internal scrollbar never engages — content past the fold becomes invisible with no way to scroll to it. **Any new page whose content might exceed one viewport should double-check its flex/grid ancestor chain has `min-h-0` at every level**, not just add `overflow-y-auto` at the leaf.
- **Hydration-mismatch toolchain quirk**: writing `className="..."` as a plain double-quoted string with the class list spread across multiple literal lines (not a template literal, not single-line) causes this Next 16 + Turbopack + React 19 setup to disagree between SSR output and client hydration on that attribute's whitespace — even for 100% static strings — tripping React's "tree hydrated but attributes didn't match" warning on every load. Fixed 6 occurrences across `TopNav.tsx`, `ServerTime.tsx`, `ColumnMapping.tsx`, `FileDropZone.tsx` by collapsing to single-line strings. **Don't write multi-line plain-string `className`s** — use single-line strings or template literals (backticks) instead, which don't trigger this.
- Separately, `ServerTime.tsx` also had a classic SSR anti-pattern: `useState(new Date())` evaluates at both server-render and client-hydration time with different timestamps, mismatching. Fixed by starting state as `null` and only setting the real value client-side in `useEffect`. While in there, also made it source the time from the backend (`GET /api/health` now returns `time: new Date().toISOString()`) instead of the browser's own clock, with a 30s resync + local 1s tick against the computed offset — it's genuinely "server" time now, not just relabeled client time.

## Database Decision (2026-07-28)
> **SUPERSEDED 2026-08-27** — Supabase is no longer the database. See *Database Decision Reversal* below. The roles/scoping guidance in the last bullet still stands and is implemented; everything about Supabase (including the auth plan) does not.
- Decided on **Supabase (Postgres)** as the project's database, admin-only for now (see Agent Instructions below re: roles). Reasoning: most domains here (users/sessions, alerts, commercial-truth hierarchy/audit logs, watchlist) are relational; Postgres `JSONB` covers the one schema-flexible need (arbitrary CSV columns from `/api/ingestion/upload`) without a second database. Ruled out MongoDB as a second store for now — not worth the operational overhead (two connections, no cross-store transactions) until/unless ingestion genuinely outgrows `JSONB`.
- Created `supabase/migrations/` at the **repo root** (not nested in `backend/`) so it's ready for the Supabase CLI's own convention (`supabase init`/`supabase link` will drop `config.toml` into this same folder without any rework) — it's project-level config for one Postgres instance, even though only `backend/` will query it.
- Still prototype-stage: no actual Supabase project is linked yet, no migrations written, `backend/` still uses in-memory mock data/sessions. This just reserves the right location.
- Auth plan: once linked, Supabase's built-in auth should replace the current hardcoded mock login in `backend/src/routes/auth.ts` (static token, any email/password succeeds, in-memory `Map` session store) rather than building real JWT verification from scratch.
- Roles: admin-only for now, by deliberate choice — future roles (employee, store manager, etc.) are deferred. When they're added, keep it additive: a `role` column/enum + a `requireRole()` middleware, not a rewrite. The one thing worth doing now (schema-level, not code-level) is including nullable `storeId`/`regionId`-style scoping fields on relevant tables from the start, since retrofitting scoping into an already-shipped schema is the expensive part, not adding new role strings.

## Vercel Deployment Log (2026-08-08)
Made all three services deployable to Vercel. Deployed as **three separate Vercel projects from this one repo**, each with a different Root Directory (`frontend/`, `backend/`, `inference/`) — there is deliberately **no root-level `vercel.json`**, since Vercel builds one project per root and a root config would fight that.

**The core adaptation pattern (applies to both API services):** each service keeps *one* app definition and *two* entrypoints, so local dev and production run identical code. Don't collapse these back into one file.
- `backend/src/app.ts` builds and exports the Express app. `src/index.ts` calls `listen()` (local/always-on); `backend/api/index.ts` exports the app directly as the Vercel handler — an Express app already *is* a `(req, res)` handler.
- `inference/app/main.py` defines the FastAPI app; uvicorn serves it locally, while `inference/api/index.py` re-exports it as a module-level `app` that Vercel's Python runtime serves as ASGI. **No uvicorn process runs in production** — uvicorn stays in `requirements.txt` for local dev only.
- Both `vercel.json`s rewrite `/(.*)` → the function. Vercel checks the filesystem *before* applying rewrites, which is why the static `public/index.html` placeholder still serves at `/` while every other path reaches the function.

**Why auth became stateless** (`backend/src/routes/auth.ts`): the old in-memory `Map<token, user>` silently breaks on serverless — each invocation can land on a fresh instance, so sessions vanish between requests. Replaced with an unsigned base64url token. This is *weaker* than before (anyone can forge one); it's acceptable only because this is a prototype. The `encodeToken`/`decodeToken` pair is the seam to swap for real signed JWT / Supabase auth.

**Traps found and fixed — these will bite again if reintroduced:**
1. **`backend/tsconfig.json` only included `src`**, so `api/index.ts` — the actual production entrypoint — was never type-checked. A break there passed `npm run build` and only failed at deploy time. Fixed by adding `api` to `include` and dropping `rootDir` (tsc's inferred root becomes the package dir, hence the `dist/src/...` layout that `npm start` now points at). Verified the gate works by pointing the entrypoint at a missing module and confirming `TS2307`.
2. **`frontend/.env.example` was untracked** — the `.env*` ignore rule swallowed it, so the only file documenting the required `NEXT_PUBLIC_API_URL` never reached the repo. Fixed with a `!.env.example` negation. Watch for this in any new service.
3. **`frontend/.npmrc` (`legacy-peer-deps=true`) is load-bearing**, not a convenience. Vercel reads it during install; without it the production build fails *before it starts* on the `react-simple-maps` / React 19 peer conflict. **Do not delete it.**
4. **`NEXT_PUBLIC_API_URL` is baked in at build time**, not read at runtime. Changing it in the Vercel dashboard does nothing until a **redeploy**. Left unset in production, the bundle ships pointing at `http://localhost:8000` and every fetch fails in the visitor's browser.
5. `engines.node` was set to a range (`>=20`) rather than a pin like `22.x` — a hard pin emits `EBADENGINE` warnings on the local Node 20 install while gaining nothing, since Vercel resolves the range to its current default anyway.

**Env vars to set per Vercel project** (deploy order matters — each needs the previous one's URL): `inference` (none) → `backend` (`PYTHON_SERVICE_URL`) → `frontend` (`NEXT_PUBLIC_API_URL`) → back to `backend` (`CORS_ORIGIN`, then redeploy). `CORS_ORIGIN` unset means `*`, which is only survivable here because the token rides in an `Authorization` header, not a cookie.

**Two limits worth remembering before trusting a deploy:**
- **Vercel has no GPU.** The inference service deploys today *only* because `/predict` returns a mock. Real PyTorch/TensorRT cannot run on Vercel's CPU-only Python functions — that's what the Corespan PRU 2500 is for. When inference moves to a GPU host, only `PYTHON_SERVICE_URL` changes.
- **In-memory writes don't survive.** `POST /api/notifications/:id/read` mutates a module-level array; a fresh instance discards it. Prototype limitation, not a Vercel one — needs the planned Supabase database either way.

**Verification done** (not just builds): both `npm run build`s pass; the Express handler was exercised the way Vercel actually invokes it (imported `dist/api/index.js`'s default export, invoked as `(req, res)`) with routes returning correctly; the FastAPI handler was imported under a Vercel-style `sys.path` and driven with `TestClient` (`/health`, `/predict`, `/docs` all 200); the backend→inference proxy was confirmed end-to-end; and `CORS_ORIGIN` was checked both ways (allowed origin gets the header, a disallowed one gets none).

## Vercel Framework-Detection Fix (2026-08-08)
First real deploy of `backend/` failed with `No entrypoint found in output directory: "public"` (searched `app|index|server.{js,ts,…}` and `src/` variants). Cause: Vercel CLI 58 auto-detects **framework presets for the API services too** — confirmed by running Vercel's own detector (`@vercel/fs-detectors`) against each root: `backend => express`, `inference => fastapi`, `frontend => nextjs`. Both API presets declare `outputDirectory: "N/A"` because they want a *server entrypoint*, not a static dir; our `vercel.json`s set `outputDirectory: "public"`, so the preset searched `public/` for a server file and found only `index.html`.

**Fix:** added `"framework": null` to both `backend/vercel.json` and `inference/vercel.json` (vercel.json overrides dashboard/auto-detected settings). This restores the zero-config model these configs were written for: `public/` = static assets, `api/` = serverless functions. The `inference/` change was preemptive — it had the identical config and would have failed identically on its next deploy.

**Why this matters beyond the error message:** without `framework: null`, even with `outputDirectory` removed the Express preset would find `src/index.ts` at the root and deploy *that* as the function — silently bypassing `api/index.ts`, making the `functions` block's `maxDuration` dead config, and shipping the `app.listen()` entrypoint that the two-entrypoint design (above) specifically keeps out of production. **Do not remove `"framework": null` from either API service**, and add it to any new non-frontend service here. `frontend/` is unaffected — it already pins `"framework": "nextjs"` explicitly, which is correct for it.

## Agent Instructions
- **Read First**: Always read this `brain.md` file when initializing a new session to restore context.
- **Update Frequently**: Whenever making architectural decisions, implementing a significant workaround (like the auth mock), or adding new tech stack dependencies, update this file so future sessions are aware of the changes.
- **Git Commits**: Never add a `Co-Authored-By` trailer or give any co-author credit to any AI agent in git commit messages.
- **No assistant references in the repo**: nothing tracked in git should name a specific AI assistant or vendor — not in code, comments, docs, or commit messages. Keep wording generic ("AI coding assistants"). Assistant-specific config directories are gitignored at the repo root for the same reason.

## Database Decision Reversal (2026-08-27)
**Supabase is out. The database is Cloudflare D1 (SQLite).** This reverses the 2026-07-28 decision above; that section is kept for the reasoning, not the conclusion.

- **Schema lives at `backend/migrations/0001_initial_schema.sql`** — 24 tables, 13 indexes, D1/SQLite dialect, verified to apply clean against `sqlite3` with FK/CHECK/`json_valid` constraints all confirmed to reject bad data. A `PORTING NOTES` block at the foot of that file lists the Postgres deltas if this is ever reversed again.
- **`supabase/migrations/` deleted** — it only ever held a `.gitkeep` reserving the location. Nothing was written there.
- **The JSONB argument is resolved, not abandoned.** Postgres was chosen partly because `JSONB` covered arbitrary CSV columns from `/api/ingestion/upload`. SQLite's equivalent is `TEXT` + `CHECK (json_valid(data))`, queried with `json_extract()`, and indexed per-field via a generated column. Confirmed with `EXPLAIN QUERY PLAN` that this produces a real index seek (`SEARCH ... USING INDEX`), not a table scan. The MongoDB ruling from July still holds; the trigger for revisiting is now "ingestion outgrows SQLite JSON", not "outgrows JSONB".
- **Consequence: auth must be built, not adopted.** The July plan was to let Supabase Auth replace the mock login "rather than building real JWT verification from scratch". D1 has no auth product, so that is now on us. The `sessions` table in the schema is the intended replacement for the unsigned stateless token (see the Vercel log for why it went stateless); a real table makes logout revocable, which the current token cannot be.
- **Consequence: no Row Level Security. This one is permanent and needs discipline.** The `region_id`/`store_id` scoping columns exist on every scopeable table as the July note advised, and on Postgres they would have been the RLS predicate — the database itself refusing to return another region's rows. D1 has no RLS, so scoping is only ever as good as the query layer. With one admin account that is theoretical. The day a second role exists, **a forgotten `WHERE region_id = ?` is a data leak with nothing behind it.** Mitigation to apply when roles land: funnel every scopeable read through one query helper that takes the caller's scope as a required argument, so the check cannot be forgotten per-route.

## Auth Rewrite Guidance (2026-08-27)
Not yet done — recorded so the constraint isn't rediscovered later.

- **Current state is worse than "mock", and the route gate does not change that.** `POST /api/auth/login` destructures `{ email }` and never reads `password` at all — any string logs in as `admin`. The token is `"mock."` + base64url of the user JSON, unsigned, so it is forgeable offline: verified by minting `{"id":"999","role":"admin"}` by hand and having `/api/auth/me` and `/api/alerts` both accept it with a 200. `requireAuth` (added 2026-08-27) gates all data routes, but it validates this forgeable credential — the door exists, the lock does not.
- **Write it with WebCrypto, not Node `crypto`/`Buffer`/`bcrypt`.** WebCrypto exists in both Node 20+ and the Cloudflare Workers runtime; native `bcrypt` and `Buffer` do not survive the Workers move. Writing auth against WebCrypto now means it ports for free instead of being written twice. This is the single highest-leverage constraint on that work.

## D1 + Google Auth Implementation (2026-08-27)
Implements the D1 decision above and replaces the mock login. **The data routes are NOT yet on D1** — see "Still on mock data" at the end.

**Transport: D1 REST API, chosen deliberately over the Workers binding.** D1 bindings (`env.DB`) only exist inside the Workers runtime; this backend is Express on Node, so every statement is an HTTPS round trip to Cloudflare (budget 50–200ms). `backend/src/db/d1.ts` is the only file that knows this — it exposes `query/first/run/batch`, so the Workers move means swapping the fetch for `env.DB.prepare()` and nothing else. **Use `batch()` for multi-statement work**; three separate calls cost three round trips. Note D1 has no interactive transactions over REST, so a batch is *not* a rollback unit. `CLOUDFLARE_D1_API_BASE` overrides the endpoint (used by the test stub).

**Auth is Google-only and invite-only.**
- `GET /api/auth/google` → mints a single-use `state` row, redirects to Google. `GET /api/auth/google/callback` → validates state, exchanges the code, then looks the account up in `users`. **There is no branch in the callback that creates a user** — that is what makes signup impossible, not a flag.
- Match order is `google_sub` first, then invited `email`. Google emails can change; `sub` cannot.
- The ID token's signature is intentionally *not* re-verified: it arrives directly from Google's token endpoint over TLS in response to a client-secret-authenticated request, which Google documents as not requiring local validation. `iss`/`aud`/`exp`/`email_verified` **are** checked. An unverified email would let someone claim an invite issued to another address.
- Token handoff to the frontend uses the URL **fragment** (`/auth/callback#token=…`), not a query string — fragments never reach a server, so the token stays out of access logs and `Referer`. The callback page strips it from history via `replaceState`.

**Sessions are real rows now.** `sessions.id` stores the **SHA-256 hash** of the token, never the token, so a leaked table cannot be replayed. `requireAuth` resolves the bearer against D1 on every request — that is the cost of revocability, and it is a second round trip per authenticated call on this transport. A D1 outage returns **503, never 200** — an auth check that fails open is worse than an outage.

**All crypto is WebCrypto + Uint8Array — no `Buffer`, no `node:crypto`.** This is load-bearing: `backend/src/auth/tokens.ts` moves to Workers unchanged. The old Buffer-based token codec would not have. **Do not reintroduce `Buffer` here.**

**Password endpoints are gone** (`/login`, `/change-password`, `/forgot-password` all 404). Google owns credentials. The frontend's password form and "Forgot Key?" were removed; Profile now links to Google account security instead.

**Bootstrap is a seeded row, and it is a manual step.** `migrations/0002_seed.sql` contains `REPLACE_WITH_YOUR_GOOGLE_EMAIL` — onboarding runs through admin-only `/api/admin/users`, so the first admin cannot be invited through the app. Edit that line before applying, and the email must match the Google account exactly.

**Verified** with a stub that speaks D1's REST envelope over a real sqlite file, so the code takes its genuine HTTP path: 22 auth/admin assertions (hand-minted `mock.` token now 401s; employee gets 403 from `/api/admin`; suspension revokes live sessions immediately; self-suspend/demote/delete blocked; logout kills the token) and 19 OAuth assertions (state persisted, single-use, expiry and replay rejected, four open-redirect payloads normalised to `/`). The token exchange was confirmed reaching Google's real endpoint.

**Still on mock data:** all eleven data route files (`alerts`, `notifications`, `marketRadar`, `commercialTruth`, `profile`, `systemStatus`, `supplyChain`, `ingestion`) still return hardcoded module-level arrays. `0002_seed.sql` already contains equivalent rows, so this is a mechanical swap to `query()` — but until it happens, the app reads from arrays and writes still vanish.


## Data Routes on D1 (2026-08-30)
Closes the "Still on mock data" item above. Every data route now reads D1; the arrays are gone. **The database is live** — `analyzehive_nexus`, uuid `3de436f3-f0e2-43bc-8256-747e10cf5610`, both migrations applied, credentials in `backend/.env` (Vercel needs the same three vars, and `CLOUDFLARE_D1_DATABASE_ID` is the **uuid**, not the name — the name is silently accepted by nothing and 404s the REST path).

**`batch()` never worked against the real API and login depended on it.** It posted a bare JSON array; Cloudflare answers `Expected object, received array`. The wire format is `{"batch":[{sql,params}...]}`. The stub used in the August 27 verification accepted the array form, which is exactly the class of bug a stub cannot catch — the auth callback batches its session insert, so **first sign-in would have failed in production**. Fixed in `d1.ts` and noted in the doc comment. Anything else verified only against that stub deserves one real round trip before it is believed.

**D1 caps bound parameters at 100 per statement** — not SQLite's 999 — and fails at execution with `too many SQL variables`. `/api/ingestion/upload` therefore inserts 33 rows (99 params) and 20 columns (100 params) per statement, ≤50 statements per HTTP call. Uploads are capped at 5,000 rows. A mid-upload failure deletes the parent `datasets` row so a partial dataset does not survive; a batch is not a rollback unit, so that cleanup is manual and deliberate.

**`batchQuery()` is new** alongside `batch()`: same one-round-trip envelope but it returns each statement's rows, for pages that need two independent reads (hierarchy + region list, activity + its count).

**Region scoping now has one chokepoint,** `src/db/scope.ts`, applied to every scopeable read. This is the mitigation the D1 decision note called for. It is a no-op while every account is an admin, and fails closed for a scoped user with no region (broadcast rows only). Do not hand-write a `region_id` filter in a route.

**Presentation moved to the UI, as the schema always intended.** The API sends ISO-8601 UTC, integer paise, and `daysToExpiry`; `frontend/src/lib/format.ts` renders "2m ago", "₹52,000", "120 days". `toIso()` in `src/db/rows.ts` is load-bearing: D1 returns `'YYYY-MM-DD HH:MM:SS'` with no zone marker, which every browser would otherwise parse as **local** time. Days-to-expiry is computed per query, so it counts down instead of freezing.

**Verified against the live database**, not a stub: a temporary active user + session was inserted directly into D1, all 14 endpoints exercised over real HTTP, then the user, its session, and two test datasets were deleted (`users` is back to the two bootstrap admins; `sessions`, `datasets`, `dataset_rows`, `notification_reads`, `activity_log` all empty). Checked along the way: per-user read state, `q=50%` escaping to zero matches rather than everything, 404s for unknown and out-of-scope ids, `limit=abc` clamping, a 250-row upload landing as rows 0–249, and the 5,001-row 413.

**Still mocked / not yet wired:** FastAPI `/predict`. Frontend-side local arrays remain in the Market Radar network graph, Live Operations map, and the dashboard's batch/inventory widgets — those have no API route behind them at all, so they are new endpoints, not a swap. `activity_log` is only written on sign-in, so Profile's activity list is genuinely short until more actions write to it.

## Light Theme Conversion (2026-09-08)
The dashboard was a dark "terminal" UI (near-black `#0b0f14`/`#0f141b` surfaces, neon-green `#7cff4e` accent). It is now a **light professional workspace theme, and light only** — the dark palette was replaced outright, not made switchable. Accent is **deep emerald `#047857`**, chosen to keep the green brand identity while holding contrast on white; the neon green was unusable on a light ground.

**Colours are now semantic tokens, not hexes. Do not reintroduce a raw colour.**
- `frontend/src/app/globals.css` has a Tailwind v4 `@theme` block defining the whole palette. Tokens are named by *role*: structure (`canvas`, `surface`, `elevated`, `sunken`, `line`, `line-strong`), text by descending emphasis (`fg`, `muted`, `subtle`, `faint`), brand (`accent`, `accent-hover`, `accent-tint`, `accent-line`) and status (`ok`/`warn`/`danger`/`info`, each with a `-tint` fill and `-line` border). Use `bg-surface`, `text-muted`, `border-line` etc. — a palette change should stay a single-file edit.
- Three elevation tokens replaced the dark theme's coloured glows: `shadow-card` (resting panel), `shadow-raised` (hover), `shadow-overlay` (modals, dropdowns, floating pills). Every `shadow-[0_0_Npx_rgba(124,255,78,…)]` neon glow is gone; on white they read as smudges, not depth.
- **`frontend/src/lib/theme.ts` mirrors the same palette as JS constants.** Recharts, `WorldMap` and `NetworkGraph` paint via SVG attributes and inline styles, which cannot read Tailwind utilities, so they import `palette` (and `intensityRamp` for the choropleth). Keep this file and the `@theme` block in step — they are the two halves of one palette.

**Surface hierarchy on light is the inverse of the old one, and mapping it wrong is the easy mistake.** On dark, "darker = further back". On light it is "canvas (`#f6f8fa`) behind, surface (white) for cards, elevated/sunken for insets *inside* a card". A nested panel is `bg-elevated`, not `bg-canvas`.

**Things that broke in the conversion and would break again:**
- **Translucent dark idioms don't survive.** `bg-white/5`, `border-white/10`, `bg-black/50` were dark-theme shorthand for "slightly lighter/darker than the parent". They map to real tokens; the only legitimate survivor is the modal scrim, now `bg-slate-900/40`. Two `bg-black/*` values were *inset panels*, not scrims, and became muddy grey blocks until caught in a screenshot.
- **`text-white` is usually `text-fg`, but not always.** Where white text sits on a *solid* accent/status fill or on a saturated `bg-*-500` (the `field_reps.color` avatars from `0002_seed.sql`), it must stay literally `text-white`. Same for `text-black` on accent buttons, which became `text-white`.
- **A white hairline between two pale choropleth fills is invisible**, so inactive countries merged into one blob. `WorldMap`'s country stroke must stay *darker* than the palest ramp step (`palette.lineStrong`).
- Fixed in passing: `NetworkGraph` built its node-icon colour with a template literal (`` text-${…} ``). Tailwind never sees runtime-built class names, so that icon was unstyled all along; it is now an inline `style={{ color }}`.
- `body` no longer forces `font-family: Arial` — it uses the `--font-geist-sans` that `layout.tsx` was already loading and previously overriding for nothing.

**Verified** with `tsc --noEmit`, `npm run lint` and `npm run build` all clean, plus real Chromium screenshots of all nine routes at 1440×900 (backend deliberately not running — the theme, not the data, was under test; pages fell back to their empty states). Two defects were found *only* in the screenshots, not the diff: the muddy inset panels and the dissolving world map.

## Professional-Feel Pass (2026-09-08)
Follow-on to the light theme conversion, same day. The theme was already clean; what still read as unserious was structure, invented content, and motion.

**One route map now feeds three consumers.** `frontend/src/lib/nav.ts` exports `NAV_ITEMS` plus `navItemFor()`/`breadcrumbFor()`. The Sidebar's nav list, the TopNav breadcrumb and every page heading read from it. **Adding a route means adding one entry there** — previously the Sidebar held its own array, each page hardcoded its own title and breadcrumb, and the TopNav breadcrumb said "Dashboard › Command Center" on all eight routes regardless of where you were.

**`frontend/src/components/PageHeader.tsx` is the only page-heading pattern.** A page renders `<PageHeader />` with no props; title and subtitle come from the route map. `actions` takes page-level controls. Don't hand-roll a header.

**AppShell owns the page container.** Padding and `max-w-[1600px]` live once in `AppShell`'s content wrapper. Pages had five different wrappers between them (`p-4 md:p-8`, `p-6 md:p-8 max-w-[1600px]`, `p-8`, plus two using `min-h-screen` *inside* the already-scrolling shell). **A page must not re-add its own padding, max-width or `min-h-screen`.**

**Invented content was deleted, not restyled.** This is the biggest single change and the one most likely to be re-introduced by copying an old pattern:
- Profile rendered a fabricated persona with no backing column — location, "Clearance: Level 4 (High Security)", "Total Missions 142", "Efficiency Rating / Top 2% of agents", "Current Rank: Elite / Next: Master", an invented professional summary and a skills list. The page was rewritten to show only what the system knows: identity from the session, role, account id, sign-in method, and the real activity log. A "Two-Factor Auth" toggle that changed nothing is gone — Google owns 2FA for these accounts.
- TopNav's "NVIDIA GPU Cluster: Active" and "Last Sync: Salesforce (1m ago) · SAP (3m ago)" were string literals presented as telemetry. Removed. The same GPU literal was also on Supply Chain Physics.
- Header status pills that asserted state nothing checked: "Neural Network: Active", "Audit Engine: Online", "Live Monitoring", "SYSTEM STATUS: OPTIMAL", and System Status's "All Systems Operational" next to the title while the panel below reported the truth. Removed; the real controls (scan toggle, region filter, refresh) survive in `PageHeader actions`.
- Live Operations' dashed "System Diagnostics & Calibration Module (Offline)" placeholder box. Removed.
- Sci-fi copy: "Operative Profile", "Identify yourself to proceed", "Restricted Operational Area", "Ent-OS v2.4".

**Currency was mixed in one view.** Supply Chain Physics showed inventory as `₹103Cr`/`₹10Cr` but projected savings via `toLocaleString("en-US", {currency:"USD"})`. Now `formatInr()` like everything else — note it takes **minor units (paise)**, matching the API.

**Motion is now disciplined, and `prefers-reduced-motion` is honoured** in `globals.css` — a blanket rule, since every animation here is decorative and loses no information when stopped. `.animate-fade-in-up` went from 0.7s/20px to 0.28s/6px with stagger delays cut proportionally (every navigation used to look like it was loading). `.card-3d-hover` no longer translates or scales — lifting a chart or table on hover made the layout feel unstable; it is a shadow change now. The decorative `animate-float` on the transfer icon and login orbs is gone.

**Per-route tab titles needed a server layout each.** The root layout sets `title.template = "%s · AnalyzeHive Nexus"` and `robots: noindex`. Every page is a client component, so **none of them can export `metadata`** — each route folder has a tiny `layout.tsx` whose only job is that export. Two other approaches were tried and rejected: setting `document.title` in an effect (Next re-applies its own metadata afterwards and wins) and rendering `<title>` for React 19 to hoist (yields three `<title>` tags, browser takes the first). The root `/` keeps the plain default deliberately.

**Verified** with `tsc --noEmit`, `npm run lint`, `npm run build` all clean, and Chromium screenshots of all eight routes at 1440×900 plus a title assertion per route. The backend was up but the preview cookie is a forged token, so data routes 401 and pages render their empty states — layout and chrome were what was under test.

**Watch out:** a `str.replace()` over JSX closing tags without a count limit silently ate a `</div>` from two sub-components in `commercial-truth/page.tsx` (both restored). Prefer indexed edits or assert the occurrence count. Separately, `p-*` followed by `/max-w-*` inside a `{/* … */}` JSX comment closes the comment early — the `*/` is real.

## Pharmaceutical Domain Build (2026-09-08)
Implements a full gap-analysis spec: the app was a generic operations dashboard wearing pharma labels. It is now a pharmaceutical supply-chain system, full stack. **Migrations 0003 and 0004 are applied to the live database.**

### Schema — `0003_pharma_domain.sql` (+ `0004_pharma_seed.sql`)
38 new tables, 25 indexes, plus four `ALTER TABLE ... ADD COLUMN` on `users` and `inventory_batches`. Both files validate against `sqlite3` and the seed is idempotent (`INSERT OR IGNORE` / `UPDATE`), so re-running is safe.

**A third money convention joins the two from 0001: one canonical currency.** Every `*_minor` column is INR paise. Display currency is a per-user preference resolved through `fx_rates` at read time. **Never store the same amount in two currencies** — they will drift. This fixes the reported ₹/$ inconsistency properly rather than by hardcoding a symbol.

Domains added: currency/FX · governance (designations, permissions, role_permissions, signature_credentials, part11_signoffs, audit_trail, user_scopes) · warehouses · command-centre KPIs (expiry_risk_snapshots, erp_sync_status) · cold chain (shipments, iot_loggers, logger_readings, route_anomalies) · freight & kinetics (freight_lanes, arrhenius_profiles, sto_writebacks) · field force (hcps, stockists, hcp_visits, stockist_sales, call_recordings, call_snippets, hcp_objections, rep_effectiveness) · market (patents, formulary_placements, regulatory_events, share_of_voice, clinical_trials) · discovery (discovery_programs, disease_models, compound_candidates) · platform telemetry (inference_metrics, ingestion_throughput).

**`audit_trail` is append-only by convention only.** D1 cannot `REVOKE UPDATE/DELETE`. Nothing in `backend/src` issues either against it, and `governance.ts` deliberately exposes no write endpoint. On Postgres this becomes a real grant — noted in the porting notes.

### Backend
New routers: `currency.ts`, `governance.ts`, `commandCenter.ts`, `coldChain.ts`, `discovery.ts`. Extended: `commercialTruth.ts`, `supplyChain.ts`, `marketRadar.ts`, `systemStatus.ts`. All wired in `app.ts` behind `requireAuth`.

**Arrhenius is computed in `supplyChain.ts`, and the units are load-bearing.** `k = A·exp(-Ea/RT)`; taking the ratio of rate constants at two temperatures cancels the unknown pre-exponential factor A, so shelf life scales by `exp(Ea/R·(1/T − 1/Tref))`. **Temperatures must be Kelvin** — doing this in Celsius silently produces nonsense. Verified against the Q10 rule: Ea=83 kJ/mol gives ~2–3× rate per 10 °C (730 d at 5 °C → 16 d at 38 °C).

Other computed endpoints: `/simulate` returns net salvage yield, thermal runway and the **stockout-risk inversion** check (does relieving expiry at the destination strand the source below its safety stock); `/visits` triangulates a claimed visit against both the clinic geofence and stockist secondary sales.

### Frontend
New: `lib/currency.tsx`, `lib/filters.tsx`, `components/WorkspaceControls.tsx` (global date range + region + currency in the header), `components/dashboard/KpiTile.tsx`, `components/supply/ArrheniusCurve.tsx`, `components/commercial/AudioWaveform.tsx`, `components/discovery/DiseaseModel3D.tsx`, and the `/drug-discovery` route. Every screen rewritten against the new endpoints.

**3D disease modelling uses `three` + `@react-three/fiber` + `@react-three/drei`** (installed with `--legacy-peer-deps`, as everything here must be). It is `dynamic(..., { ssr: false })` — WebGL cannot render server-side, and this keeps the three.js bundle off every other route's chunk.

**`KpiTile` takes `goodDirection` for a reason:** "up" is not universally good. Capital saved rising is progress; value-at-risk rising is not. Colouring both green would mislead on the executive screen.

### Traps found during this build — all cost real time
1. **`Intl.NumberFormat` with `notation: "compact"` is not SSR-safe.** Node's ICU renders `₹0.00` where Chrome renders `₹0`, a hydration mismatch on every money value. `format()` now returns `—` until the rate table has loaded, which also happens to be the honest answer.
2. **`react-hooks/set-state-in-effect` (React Compiler lint) rejects `setState` in an effect body.** Reading `localStorage` that way fails lint; `useSyncExternalStore` is the correct primitive and `filters.tsx` uses it. A `setState` inside a `.then()` callback is fine — that is why `ServerTime` always passed.
3. **Seed dates must respect the window the query measures.** Stockist sales were seeded on the visit date, so the "7 days after" window was always empty and every row rendered as a −100% collapse. Visits now sit 12–17 days back with sales on both sides.
4. **Logger readings must respect each shipment's own band.** A hardcoded 2–8 °C range made the frozen lane (−20…−15 °C) look like a permanent 20-degree excursion and poisoned the mean-variance KPI.
5. **Seeded magnitudes have to be plausible against existing numbers.** GVER first came out at ₹0.4 Cr against ₹103 Cr of inventory. It is ₹10 Cr now.
6. **Clamp a slider's *state*, not just its rendered value.** Switching SKU left `units` at 2000 against 900 on hand, so the shortfall went negative.
7. Hours stop being readable past a few days — thermal runway showed `8858 h`.

### Verified
`tsc --noEmit`, `npm run lint`, `npm run build` clean on both services. All 21 new endpoints exercised over real HTTP against the live D1 with a temporary session (since removed — `users` is back to the two bootstrap admins, and **the owner's own live session was left untouched**). Chromium screenshots of all eight routes with real data, zero console errors. Arrhenius and simulator arithmetic checked by hand against known chemistry.

### Not done
`/api/supply-chain/sto` writes a `pending` row and stops — there is no SAP integration to acknowledge it. That is deliberate: a fabricated document number would be worse than an honest pending state. `call_recordings.audio_url` is NULL, so the waveform renders as an interactive timeline with markers and says plainly that no audio is attached.

## Synthetic Dataset (2026-09-08)
The live database now holds **~744k generated rows across 60 tables**, on top of the migration seeds. `backend/scripts/generate-synthetic-data.py` produces it deterministically (fixed PRNG seed, `INSERT OR IGNORE`, surrogate keys from 100000), and `backend/scripts/load-sql.py` applies it. Regenerating gives byte-identical output, so the dataset is reproducible rather than a one-off.

**Three tables are deliberately never populated**, and this is a rule not an oversight: `users` (the auth allowlist — inventing accounts invents access), `sessions` (a row there *is* a live credential) and `oauth_states` (single-use and expiring by design).

**Three stay small on purpose:** `regions` (12), `currencies` and `fx_rates` (24 each). They are option lists, and `Intl.NumberFormat` **throws** on a currency code that is not real ISO 4217 — padding them to 1000 with invented codes would break the currency switcher outright. Everything else clears 1000.

**Two D1 limits, both measured rather than guessed** (see `scripts/README.md`):
1. A `/query` payload above **~1.25MB** returns `SQLITE_TOOBIG: statement too long`. The first attempt failed at exactly the file that overshot 1.25MB, because the writer flushed *after* crossing its threshold.
2. Per-statement, the ceiling is far below SQLite's nominal 1MB: a **52KB** INSERT succeeds and a **105KB** one fails. The generator caps statements at 45KB. Chasing this cost three failed loads — the error message points at statement length either way, so only bisecting told them apart.

**`INSERT OR IGNORE` only dedupes rows that carry an explicit key.** `stockist_sales` and `logger_readings` insert without an id and lean on `AUTOINCREMENT`, so three interrupted-and-retried loads left `stockist_sales` at 182k rows where 50k were distinct. Repaired by deleting the generated rows and re-inserting once. **Clear those two before any re-run.**

**Realistic volume broke the API, and that was the point of loading it.** Endpoints that were fine against a few hundred seed rows fell over: `/api/commercial-truth/visits` ran a correlated subquery per row over 50k sales and 503'd after 15s; `/api/cold-chain/shipments` did six correlated subqueries per row, one over 159k readings; `/api/supply-chain/watchlist` returned a 3.8MB payload. Fixes:
- `backend/src/db/paging.ts` — `pageLimit(req, fallback, max)`. **Every list route needs one.**
- For the two O(n²) queries the limit had to move *inside* a subquery so the page is narrowed **before** the correlated lookups run; a trailing `LIMIT` still costs the full scan.
- All 22 endpoints now return 200 in under 1.5s with KB-sized payloads.

**Frontend consequence:** 20k batches over 1500 SKUs meant the simulator's SKU picker had duplicate React keys. The watchlist is per *batch*, the simulator operates on a *SKU* — the picker now collapses to the first batch per SKU.
