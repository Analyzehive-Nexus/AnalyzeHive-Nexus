# Data scripts

## `generate-synthetic-data.py`

Writes a deterministic synthetic dataset as chunked SQL files.

```bash
python3 scripts/generate-synthetic-data.py ./out
```

Roughly 744k rows across 60 tables, seeded with a fixed PRNG so a re-run
produces byte-identical output. Every statement is `INSERT OR IGNORE` and
surrogate keys start at 100000, so it composes with the migration seeds
instead of fighting them.

**What it deliberately does not touch**

| table | why |
|---|---|
| `users` | the auth allowlist - inventing accounts invents access |
| `sessions` | a session row is a live credential |
| `oauth_states` | single-use, expiring, transient by design |

`regions`, `currencies` and `fx_rates` stay small on purpose: they are option
lists, and `Intl.NumberFormat` throws on a currency code that is not real
ISO 4217, so padding them with invented values would break the UI.

## `load-sql.py`

Applies a directory of `.sql` files to D1 over the REST API, with retry on
5xx and 429.

```bash
set -a && . .env && set +a
python3 scripts/load-sql.py ./out
```

**Two D1 limits this had to be tuned around, both measured rather than
guessed:**

1. **~1.25MB per request.** A payload above that returns
   `SQLITE_TOOBIG: statement too long`.
2. **Well under 1MB per individual statement.** A 52KB `INSERT` succeeds and
   a 105KB one fails, so the generator caps statements at 45KB.

**Re-running is only safe for tables whose rows carry an explicit key.**
`stockist_sales` and `logger_readings` insert without an id and rely on
`AUTOINCREMENT`, so `INSERT OR IGNORE` cannot dedupe them - an interrupted
run that is retried will duplicate those two. Clear them first if you re-run:

```sql
DELETE FROM stockist_sales WHERE stockist_id NOT IN ('STK-501','STK-502','STK-503','STK-504');
```
