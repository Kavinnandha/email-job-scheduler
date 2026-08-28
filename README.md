# Email Job Scheduler

A production-grade email scheduling service and dashboard. Emails are accepted over an API, persisted to Postgres, scheduled as **BullMQ delayed jobs** (no cron anywhere), and delivered through **Ethereal** SMTP from multiple senders under configurable concurrency, inter-send delay and hourly rate limits. Scheduled and sent mail is searchable through Elasticsearch, queue state is visible live through a BullMQ dashboard, and a Slack message is posted the moment a sender exhausts its hourly quota.

---

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [How scheduling works](#how-scheduling-works)
- [Persistence across restarts](#persistence-across-restarts)
- [Concurrency, delay and rate limiting](#concurrency-delay-and-rate-limiting)
- [Behaviour under load](#behaviour-under-load)
- [Delivery guarantee](#delivery-guarantee-stated-honestly)
- [Slack notifications](#slack-notifications)
- [Search](#search)
- [API reference](#api-reference)
- [Feature checklist](#feature-checklist)
- [Verification performed](#verification-performed)

---

## Architecture

```
                    ┌──────────────────────────┐
   Browser ────────▶│  React SPA (Vite, :5173) │
                    └────────────┬─────────────┘
                                 │ session cookie
                    ┌────────────▼─────────────┐
                    │  Express API (:4000)     │──▶ /admin/queues (bull-board)
                    └─┬──────────┬───────────┬─┘
                      │          │           │
              ┌───────▼──┐  ┌────▼─────┐  ┌──▼────────────┐
              │ Postgres │  │  Redis   │  │ Elasticsearch │
              │ (record) │  │ (queue)  │  │  (search)     │
              └───────┬──┘  └────┬─────┘  └──▲────────────┘
                      │          │           │
                    ┌─▼──────────▼───────────┴─┐
                    │  Worker process           │──▶ Ethereal SMTP
                    │  (BullMQ consumer)        │──▶ Slack webhook
                    └───────────────────────────┘
```

**The API and the worker are separate processes.** They share the database and Redis but scale and restart independently: the API can go down without pausing delivery, and the worker can be restarted mid-campaign without dropping requests.

**Postgres is the system of record.** Redis holds the schedule and Elasticsearch holds the search index, but both are rebuildable from Postgres. This is what makes the restart guarantees below hold.

```
apps/
  backend/
    src/
      config/env.ts          zod-validated configuration, fails fast at boot
      auth/                  Google OAuth, Redis-backed sessions
      mail/                  sender pool, pooled SMTP transports
      queue/                 queue, scheduler, processor, boot reconciler
      ratelimit/limiter.ts   atomic send slot + two-tier hourly limiter (Lua)
      slack/                 OAuth connect + rate-limit notification
      search/emails.ts       indexing, search, Postgres fallback
      routes/                HTTP layer
      index.ts               API entrypoint
      worker.ts              worker entrypoint
  frontend/
    src/
      api/                   typed fetch client
      components/ui/         reusable primitives
      hooks/                 auth and email-list data hooks
      pages/                 Login, Dashboard
packages/
  shared/                    types shared by API and SPA
```

---

## Quick start

**Prerequisites:** Node 20+, pnpm, Docker.

```bash
git clone https://github.com/Kavinnandha/email-job-scheduler.git
cd email-job-scheduler
pnpm install
```

**1. Start infrastructure**

```bash
docker compose up -d
```

Brings up Postgres (`:5432`), Redis (`:6379`, with `appendonly yes`) and Elasticsearch (`:9200`).

**2. Configure**

```bash
cp .env.example .env
```

Generate a session secret and paste it into `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then add Google and Slack credentials — see [Configuration](#configuration).

**3. Migrate the database**

```bash
pnpm db:migrate
```

**4. Run everything**

```bash
pnpm dev
```

Starts the API, the worker and the SPA together. Individually:

```bash
pnpm dev:api      # Express API on :4000
pnpm dev:worker   # BullMQ worker
pnpm dev:web      # React dashboard on :5173
```

| URL | What |
|---|---|
| http://localhost:5173 | Dashboard |
| http://localhost:4000/health | Health of Postgres, Redis, Elasticsearch |
| http://localhost:4000/admin/queues | Live BullMQ dashboard (basic auth) |

### Ethereal SMTP — no signup needed

Sender accounts are provisioned automatically on first boot. `SENDER_COUNT` (default 3) mailboxes are created through the Ethereal API and cached in `.ethereal-accounts.json` (gitignored) so restarts reuse the same inboxes rather than stranding sent mail in inboxes nobody can reopen.

Every delivered email stores a preview URL, surfaced as **View message** in the Sent tab.

> Accounts are created by calling the Ethereal API directly rather than nodemailer's `createTestAccount()`, which memoises its result and would hand back the same mailbox N times — collapsing the sender pool to one and making per-sender rate limiting meaningless.

To use your own SMTP accounts instead, set `SMTP_SENDERS` to a JSON array (this overrides `SENDER_COUNT`):

```
SMTP_SENDERS=[{"name":"Sales","fromEmail":"a@x.com","smtpHost":"smtp.ethereal.email","smtpPort":587,"smtpUser":"...","smtpPass":"..."}]
```

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create credentials** → **OAuth client ID** → **Web application**
3. Authorised redirect URI: `http://localhost:4000/api/auth/google/callback`
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

Missing Google credentials is a warning, not a boot failure — the rest of the API still runs and the login route explains the misconfiguration.

### Slack OAuth

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions** → add the **`incoming-webhook`** scope
3. Redirect URL: `http://localhost:4000/api/slack/callback`
4. Copy the client ID and secret into `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`

Connect from the dashboard header. Slack asks which channel to post to, and returns a webhook bound to just that channel — the app never holds permission to post anywhere else.

---

## Configuration

Every value is read from the environment and validated with zod at boot; nothing is hardcoded. An invalid value exits immediately with an explanation rather than failing confusingly later.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin and OAuth redirect target |
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch node |
| `SESSION_SECRET` | — | Session signing key (min 16 chars) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | — | Google OAuth app |
| `SLACK_CLIENT_ID` / `_SECRET` | — | Slack OAuth app |
| **`WORKER_CONCURRENCY`** | `5` | Jobs processed in parallel per worker |
| **`DELAY_BETWEEN_EMAILS_MS`** | `2000` | **Minimum gap between sends from one sender** |
| **`MAX_EMAILS_PER_HOUR_PER_SENDER`** | `200` | Hard per-sender ceiling; breaching it alerts Slack |
| **`MAX_EMAILS_PER_HOUR_GLOBAL`** | `0` | Ceiling across all senders (`0` disables) |
| `DEFAULT_CAMPAIGN_HOURLY_LIMIT` | `100` | Used when the compose form leaves it blank |
| `ORDER_STEP_MS` | `250` | Re-spread step when jobs move to the next hour window |
| `SENDER_COUNT` | `3` | Ethereal mailboxes to provision |
| `SMTP_SENDERS` | — | JSON array of real SMTP accounts (overrides above) |
| `BULL_BOARD_USER` / `_PASS` | `admin` / `admin` | Queue dashboard credentials |

**The chosen minimum delay is 2 seconds** (`DELAY_BETWEEN_EMAILS_MS=2000`) between consecutive sends from the same sender.

---

## How scheduling works

No cron, no `node-cron`, no polling loop. Scheduling is entirely BullMQ delayed jobs.

`POST /api/campaigns` does the following:

1. **Validate and normalise recipients** — trimmed, lowercased, de-duplicated, obviously invalid addresses dropped. The response reports how many were skipped.
2. **Write rows in one transaction** — a `Campaign` plus one `Email` per recipient.
3. **Assign a sender per email at schedule time**, round-robin by `sequenceIndex`. This is stored on the row rather than chosen in the worker, so a retried or rescheduled job always targets the same sender. Rate-limit counters, send-slot reservations and Slack alerts therefore stay attributed to one sender across attempts, and the dashboard can show the sender while an email is still scheduled.
4. **Stagger send times**: `scheduledAt[i] = max(startTime, now) + i × delayMs`. The inter-send delay is baked into the schedule itself; the worker's slot reservation is the backstop for when a backlog comes due at once.
5. **Enqueue one delayed BullMQ job per email**, with `delay = scheduledAt − now`.

**Rows are written before jobs are enqueued.** A crash between the two leaves emails the boot reconciler will pick up. The reverse order could leave a job pointing at a row that was never committed.

### Idempotency

Each job's id is derived from its email id (`email-<id>`). BullMQ refuses to add a second job with an existing id, so enqueueing is idempotent for free — re-running the scheduler, or the reconciler re-adding a job that is still queued, cannot produce a duplicate.

Four layers guard against double sending:

| Layer | Prevents |
|---|---|
| Deterministic job id | Duplicate enqueue |
| `status !== 'SCHEDULED'` early return | Replayed or twice-promoted job |
| Guarded `UPDATE … WHERE status='SCHEDULED'` | Two workers racing the same email |
| `UNIQUE` constraint on `messageId` | Makes any duplicate that slips through detectable |

> The job id separator is `-`, not `:` — BullMQ reserves colons for its own Redis key namespacing and rejects them in custom ids.

---

## Persistence across restarts

Two independent mechanisms, covering two genuinely different failures.

**1. Redis persistence — ordinary restarts.** Redis runs with `appendonly yes`, so the delayed set survives a restart. Jobs that came due while the process was down fire on recovery, paced by the guards rather than bursting.

**2. Boot reconciliation — Redis data loss.** Before the worker consumes anything, it reads every `SCHEDULED` email from Postgres and re-adds any that has no job in the queue. Postgres is the system of record, so the entire schedule is reconstructable from it. Re-adding is safe because job ids are deterministic — a job that is still queued is not duplicated.

Reconciliation logs exactly what it did, which distinguishes the two cases at a glance:

```
reconciliation complete  scheduledInDb=6  alreadyQueued=6  reEnqueued=0   ← Redis persistence worked
reconciliation complete  scheduledInDb=6  alreadyQueued=0  reEnqueued=6   ← rebuilt after data loss
```

### Verify it yourself

```bash
# Schedule something well into the future, then:

# A. Restart the worker — jobs survive, nothing re-added
#    expect: alreadyQueued=N, reEnqueued=0

# B. Restart Redis — AOF preserves the delayed set
docker compose restart redis
#    expect: same delayed count, identical fire times

# C. Destroy Redis data — reconciliation rebuilds from Postgres
docker compose exec redis redis-cli FLUSHALL
#    then restart the worker; expect: alreadyQueued=0, reEnqueued=N
```

Only **C** actually exercises the reconciliation path — **B** is a test of Redis persistence, and the two are easy to confuse.

---

## Concurrency, delay and rate limiting

All three are enforced in Redis so they hold across concurrent jobs **and** across multiple worker processes. Nothing relies on in-memory counters.

### Worker concurrency

`WORKER_CONCURRENCY` (default 5) sets how many jobs a worker handles in parallel. Everything below is written to be correct at any concurrency.

### Minimum delay between sends — atomic slot reservation

The obvious implementation is broken:

```
read last-send time → compare → send → write new time     ✗
```

The moment concurrency exceeds 1, N workers read the same stale timestamp, all conclude the gap has elapsed, and all send together — the guarantee fails in exactly the situation it exists for.

Instead, comparison and reservation happen in **one Lua script**, so they cannot be interleaved:

```lua
local nextAllowed = tonumber(redis.call('GET', key) or '0')
if nextAllowed > now then return nextAllowed - now end   -- busy: caller waits
redis.call('SET', key, now + gap, 'PX', gap + 60000)
return 0                                                  -- reserved
```

The slot is claimed **before** the SMTP call, not after, so a slow send cannot let a second job slip in behind it. A job that loses is rescheduled with `moveToDelayed`, not failed. Releasing a slot is ownership-guarded by value, so a job cannot clear a reservation another worker has since taken.

### Hourly limits — two independent tiers

| Tier | Source | Purpose | Alerts Slack |
|---|---|---|---|
| **Hard per-sender** | `MAX_EMAILS_PER_HOUR_PER_SENDER` | Protects the SMTP account. A campaign can never exceed it. | **Yes** |
| **Per-campaign** | User's compose form | Pacing preference, counted on its own key | No |
| Global (optional) | `MAX_EMAILS_PER_HOUR_GLOBAL` | Ceiling across all senders | No |

Keys are windowed by hour: `rl:sender:<id>:<hour>`, `rl:campaign:<id>:<hour>`, `rl:global:<hour>`.

Separating the tiers matters. Two campaigns sharing a sender each get their own pacing while still summing under the hard ceiling, and a user's own pacing choice is not treated as an operational incident. The per-campaign value is clamped to the hard ceiling on the way in, so the form cannot be used to exceed it.

All tiers are consumed in **one Lua script** that increments each counter and, if any would exceed its limit, rolls back every increment it already made:

```lua
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ttl) end
  table.insert(incremented, KEYS[i])
  if count > tonumber(ARGV[i]) then
    for _, k in ipairs(incremented) do redis.call('DECR', k) end
    return i                                    -- which tier blocked
  end
end
return 0
```

All-or-nothing is the point. Incrementing tiers sequentially from Node lets a job blocked by the second tier leave the first tier's counter permanently inflated — counters drift upward under concurrency and the effective limit silently decays.

The sender tier is evaluated first, so when both are exhausted the alertable tier is the one reported.

### When a limit is hit

Nothing is dropped and nothing is hard-failed.

1. The reserved send slot is handed back.
2. The job moves to the next hour window: `nextWindowStart + sequenceIndex × ORDER_STEP_MS`, which re-spreads the campaign so relative order survives the deferral.
3. If the **hard sender** tier blocked, one Slack message is sent.

Deferral uses `moveToDelayed` followed by `DelayedError` — BullMQ's handshake for *"not now, try later"*. Throwing anything else would count as a failure and consume a retry, so a rate-limited campaign would exhaust its attempts and dead-letter instead of simply waiting for capacity.

A send that genuinely fails **refunds** its hourly quota, so a failure does not permanently burn capacity, and `FAILED` is only written once retries are exhausted.

### Trade-offs

- **BullMQ's built-in limiter was not used.** It is per-queue, and the requirement is per-sender with a second per-campaign tier on top. Redis counters express that directly.
- **Order is preserved approximately, not exactly.** With concurrency above 1, jobs finish out of order by design. `sequenceIndex` keeps deferred batches in relative order, but strict global ordering would require concurrency 1 and cost throughput.
- **Fixed hour windows, not a sliding window.** Simpler and cheaper — one `INCR` per send instead of a sorted set per sender. The cost is that capacity refills at the hour boundary rather than rolling continuously.

---

## Behaviour under load

**1000+ emails scheduled for the same moment.** All are created as delayed jobs staggered by `delayMs` and held in Redis, which promotes them by timestamp — they are never all resident in the worker at once. Concurrency caps parallel sends, and the slot reservation serialises per sender regardless of how many workers are running.

**The rate limit would be exceeded.** Jobs beyond the limit are moved into the next hour window, re-spread by `sequenceIndex`. Capacity refills at the hour boundary and the backlog drains in order. Given 1000 emails, one sender and a 200/hour ceiling, delivery spreads across roughly five hourly windows, with one Slack alert per sender per window. No job is dropped, failed, or restarted from the beginning.

**A backlog comes due at once after downtime.** Past-due emails enqueue with `delay = 0`, then the slot reservation paces them apart rather than letting them fire simultaneously.

---

## Delivery guarantee, stated honestly

**The system is effectively-once, not provably exactly-once.**

There is one unavoidable window: the worker hands a message to SMTP, Ethereal accepts it, and the process dies *before* the status write commits. The row is still `SCHEDULED`, so the job re-runs on recovery and the recipient receives a second copy.

No queue-plus-database design closes this without a distributed transaction spanning an external SMTP server that offers no such protocol. The acknowledgement and the state write cannot be made atomic.

What the design does buy:

- The window is **milliseconds wide** — a single indexed primary-key `UPDATE`, issued as the first statement after `sendMail` resolves — rather than spanning the whole send path.
- Every **other** duplication source is closed: duplicate enqueue, two workers on one email, retry after a pre-SMTP failure, reconciliation re-adding a live job, replay after a Redis wipe.
- `messageId` carries a `UNIQUE` constraint, so a duplicate that does occur is visible in the database rather than silent.

This is stated plainly rather than claiming a guarantee the architecture cannot make.

---

## Slack notifications

Real OAuth v2 with the `incoming-webhook` scope, connected from the dashboard header.

- **One alert per sender per hour window.** Claimed with `SET NX`, so a limit hit by hundreds of concurrent jobs still produces exactly one message.
- **Only the hard per-sender tier alerts.** A user's own campaign pacing working as configured is not an incident.
- **Not connected is a no-op, never an error.** A missing integration must not disturb delivery.
- **Connect later and it just works.** The webhook is read fresh from the database on every call, so notifications begin immediately with no redeploy or restart. Disconnect and reconnect behave the same way; reconnecting replaces the webhook rather than accumulating stale ones.
- **Slack being unreachable never fails a send.** Failures are logged and swallowed.

`POST /api/slack/test` posts a real message so the connection can be verified without first driving a sender into its limit.

CSRF is handled with a random `state` stored in the session and required to match on return, so a forged callback cannot bind an attacker's workspace to someone else's account.

---

## Search

Every email is indexed into Elasticsearch on schedule, on send and on failure, upserted by id so a status change never leaves two documents.

`GET /api/emails/search?q=` runs a `multi_match` over subject, recipient and body — subject and recipient boosted, `fuzziness: AUTO` — always filtered to the requesting user.

Two deliberate choices:

- **Elasticsearch returns ids only; rows are re-read from Postgres.** The response is therefore never stale relative to a status change the index has not caught up with. Relevance order is restored afterwards, since `findMany` ignores the order of an `IN` list.
- **A dead cluster degrades, it does not break.** Queries fall back to a Postgres `ILIKE` search, losing ranking but not function, and the response reports which path served it. `/health` surfaces Elasticsearch separately and does **not** report unhealthy when only search is down. Indexing failures are logged and swallowed — throwing after mail reached SMTP would cause the retry to send a duplicate.

---

## API reference

All `/api` routes except the auth and Slack callbacks require an authenticated session.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/google` | Begin Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback → dashboard |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/logout` | Destroy session |
| `POST` | `/api/campaigns` | Schedule a campaign |
| `GET` | `/api/campaigns` | Campaigns with per-status counts |
| `GET` | `/api/emails?status=&page=` | Paginated emails |
| `GET` | `/api/emails/search?q=&status=` | Full-text search |
| `GET` | `/api/senders` | Active sender pool |
| `GET` | `/api/slack/start` | Begin Slack OAuth |
| `GET` | `/api/slack/callback` | Slack callback |
| `GET` | `/api/slack/status` | Connection state |
| `POST` | `/api/slack/disconnect` | Remove integration |
| `POST` | `/api/slack/test` | Send a test Slack message |
| `GET` | `/health` | Dependency health |
| `GET` | `/admin/queues` | BullMQ dashboard (basic auth) |

<details>
<summary><code>POST /api/campaigns</code></summary>

```jsonc
{
  "subject": "Quick question",
  "body": "Hi there…",
  "recipients": ["a@example.com", "b@example.com"],
  "startTime": "2026-08-28T14:00:00.000Z",
  "delaySeconds": 2,
  "hourlyLimit": 100,
  "senderIds": []            // omit or empty to use every active sender
}
```

```jsonc
{
  "campaign": { "id": "…", "counts": { "scheduled": 2, "sent": 0, "failed": 0, "total": 2 } },
  "scheduled": 2,
  "skipped": 1               // duplicates and invalid addresses
}
```
</details>

---

## Feature checklist

### Backend

| Requirement | Status | Where |
|---|---|---|
| TypeScript + Express | Done | `apps/backend` |
| Scheduling API | Done | `routes/campaigns.ts` |
| Relational storage | Done | Postgres + Prisma, `prisma/schema.prisma` |
| BullMQ delayed jobs, **no cron** | Done | `queue/scheduler.ts` |
| Multiple senders via Ethereal | Done | `mail/senders.ts` — distinct mailboxes |
| Elasticsearch indexing + search | Done | `search/emails.ts` |
| Live BullMQ dashboard | Done | `/admin/queues`, basic auth |
| Survives restart, no duplicates | Done | AOF + `queue/reconcile.ts` |
| Configurable worker concurrency | Done | `WORKER_CONCURRENCY` |
| Minimum delay between sends | Done | Atomic Lua slot reservation, 2s default |
| Hourly rate limit, multi-worker safe | Done | Two-tier Lua limiter, Redis counters |
| Limits configurable, not hardcoded | Done | `config/env.ts`, zod-validated |
| Rate-limited jobs deferred, not dropped | Done | `moveToDelayed` + `DelayedError` |
| Order preserved as far as practical | Done | `sequenceIndex × ORDER_STEP_MS` |
| Slack OAuth + live alert on limit | Done | `slack/`, one alert per sender per window |
| Idempotent sending | Done | Four layers — see [Idempotency](#idempotency) |

### Frontend

| Requirement | Status | Where |
|---|---|---|
| Real Google OAuth login | Done | `pages/Login.tsx` |
| Header with name, email, avatar, logout | Done | `components/Header.tsx` |
| Scheduled / Sent tabs | Done | `pages/Dashboard.tsx` |
| Compose modal | Done | `components/ComposeModal.tsx` |
| CSV upload with detected-address count | Done | `lib/csv.ts` |
| Start time, delay, hourly limit inputs | Done | `components/ComposeModal.tsx` |
| Scheduled table | Done | `components/EmailTable.tsx` |
| Sent table with status and preview link | Done | `components/EmailTable.tsx` |
| Loading, empty and error states | Done | `components/ui/Table.tsx` |
| Toasts | Done | `components/ui/Toast.tsx` |
| Reusable primitives, DRY | Done | `components/ui/` |
| Typed API responses and props | Done | `packages/shared` |

Lead files are parsed by scanning for anything shaped like an address rather than by column position, because exports vary in column order, headers and quoting — and some are just newline-separated lists. Duplicates are removed and reported before scheduling.

---

## Verification performed

Everything below was run against live Postgres, Redis, Elasticsearch and Ethereal — not asserted from reading the code.

**Scheduling**
- 5 recipients staggered at exactly the configured 2s interval
- Round-robin distribution 2/2/1 across three senders
- 5 delayed jobs whose fire times match their `scheduledAt` values
- Re-enqueueing the same emails left the delayed count unchanged (no duplicates)

**Concurrency** (the cases where naive implementations break)
- 50 concurrent slot reservations → exactly 1 winner, 49 told to wait 2000ms
- Slot release refused a second, non-owning call
- 200 concurrent quota consumes against a limit of 10 → exactly 10 allowed, **both counters landed on exactly 10 with no drift**
- Campaign limit 500 against a sender ceiling of 200 → 200 allowed, blocked by the `SENDER` tier
- 100 concurrent Slack alert claims → exactly 1 winner

**Delivery**
- 6 recipients, one sender, campaign limit 3 → 3 genuinely delivered with working Ethereal preview URLs
- Remaining 3 rescheduled to `08:00:00.250`, `08:00:01.000`, `08:00:01.250` — next window, spread by `sequenceIndex`, order preserved
- Sent + still-scheduled = 6; nothing dropped
- Zero duplicate `messageId` values

**Persistence** (all three cases)
- Worker restart → `alreadyQueued=6, reEnqueued=0`; fire times identical
- `docker compose restart redis` → AOF preserved all 6 delayed jobs, fire times identical
- `redis-cli FLUSHALL` → queue emptied, then `alreadyQueued=0, reEnqueued=6` rebuilt from Postgres. The one past-due email sent immediately on recovery while the 5 future ones kept their original times.

**Frontend** — driven through the real UI in a browser
- Composed a campaign end to end: a 4-row CSV containing one duplicate reported **"3 email addresses detected (1 duplicates removed)"**
- Submission produced *"Scheduled 3 emails"*, closed the modal and populated the table
- With a campaign limit of 2: 2 delivered across different senders, 1 deferred, one rate-limit event logged
- Sent tab showed both rows with working preview links

**A bug this caught:** switching to the Sent tab showed a stale *"No sent emails yet"* after mail had already gone out — the global `staleTime` suppressed the refetch. Fixed by treating email lists as always stale, since the worker changes them from outside the browser.

**Other checks** — `/admin/queues` returns 401 unauthenticated and 200 with credentials; a Slack callback carrying a forged `state` redirects to `?slack=invalid_state` without creating an integration; `/health` reports `ok` with Elasticsearch down, confirming search degrades without affecting delivery.

### A note on the minimum delay

The delay paces **when sends are initiated**, not when they complete. Measured `sentAt` gaps were 1870ms and 3360ms against a 2000ms setting, because `sentAt` records SMTP completion and per-message latency varies. The slot reservations themselves were correctly 2000ms apart. Pacing initiation is what a real provider throttle does.

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | API + worker + SPA together |
| `pnpm dev:api` / `dev:worker` / `dev:web` | Individually |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Typecheck the workspace |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm infra:up` / `infra:down` | Docker services |
