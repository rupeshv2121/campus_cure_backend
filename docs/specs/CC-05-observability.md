# CC-05: Observability

| | |
|---|---|
| **Status** | **Implemented** 2026-09-23 — code complete and tested; reporting dormant until a DSN is set |
| **Phase** | 0 |
| **Branch** | `feat/CC-05-observability` |
| **Repos** | both |
| **Depends on** | CC-00 |
| **Blocks** | CC-41 |
| **Estimate** | 1 day |
| **Shipped** | — |

## Problem

Three gaps, found by reading the code rather than by guessing at what "observability" should mean.

**1. The backend had no error handler at all.** Nothing in `app.ts` after `app.use(routes)`. An
unhandled throw fell through to Express's built-in handler, which answers with an **HTML** page —
and, whenever `NODE_ENV` is not `production`, one containing the full stack trace. That is two
failures in one: a JSON client cannot parse an HTML body, so every frontend error path degraded to
"something went wrong"; and a stack trace naming internal paths and dependency versions was being
returned to the browser.

**2. The frontend had no error boundary.** A single render error unmounted the whole React tree and
left a blank white page — no message, no recovery, nothing recorded. The only possible bug report
was "the site stopped working".

**3. Nothing was correlated.** Logging was `console.log` with ad-hoc prefixes. Given a 500 in the
Vercel log stream there was no way to find the other lines from the same request, let alone the
frontend error that followed it.

## Goal

Every request carries an id. Every log line is structured and carries that id. Every unhandled error
— server, browser, render, promise — is caught, logged, and reportable to Sentry, with the same id
joining the two halves.

## Non-goals / Out of scope

- **Performance tracing, profiling, session replay.** Volume and cost for a problem we do not have.
- **Uptime monitoring / alerting.** A different tool; nothing here prevents adding one.
- **Log aggregation.** Vercel captures stdout. If that stops being enough, `logger.ts` is the single
  place that changes.
- **Auditing.** CC-61 already owns the immutable trail of privileged actions. This is diagnostics,
  and the two must not be confused: an audit log that can be switched off by `LOG_LEVEL` is not one.

## Design

### Why no SDK, on either side

Every provider in this codebase — HuggingFace, Groq, Mistral, Resend, Telegram — is hand-rolled
against its HTTP API. Sentry's ingest endpoint takes a three-line newline-delimited envelope, so
`captureException` is one `fetch`.

Beyond consistency: `@sentry/node` v8+ pulls in OpenTelemetry auto-instrumentation and patches the
runtime at import, which is a large addition to a serverless function whose cold start is the thing
users feel. `@sentry/browser` ships its own fetch and history instrumentation into a bundle already
carrying antd, face-api and KaTeX.

**What that costs, stated plainly rather than discovered later:**

| Lost | Mitigation |
|---|---|
| Breadcrumbs | The structured logs for that request id *are* the trail |
| Source-map-resolved frames | Stacks point at compiled output |
| Performance tracing | Out of scope anyway |
| Auto-capture of rejections | Wired explicitly in `index.ts` and `installGlobalHandlers` |

`captureException` / `reportError` are the entire surface. Swapping either body for the real SDK is
a contained change if the trade stops being worth it.

### Request context via AsyncLocalStorage

`requestContext.ts` holds the request id and user id for the lifetime of one request, so a log line
written five calls deep correlates without threading a parameter through every signature.

`AsyncLocalStorage`, **not** a module-level variable. Node serves overlapping requests on one
thread, so a module-level "current request" would attribute one student's error to whoever happened
to be mid-`await`. That is not a rare race — it is the normal case under any concurrency, and it
would put the wrong user id on a security-relevant log line. There is a test for it.

### Redaction is the load-bearing part

Log output reaches Vercel; Sentry reaches a third party. This codebase handles passwords, JWTs,
refresh tokens, a Supabase service-role key, biometric templates and students' guardian phone
numbers. `redact` walks every metadata object against a deliberately broad key list — a false
positive costs a `[redacted]` in a log line, a false negative puts a live credential in a log
aggregator forever.

> **A real bug this caught.** The first implementation stripped everything except letters *and
> underscores* before matching. `SUPABASE_SERVICE_ROLE_KEY` normalised to
> `supabase_service_role_key`, the pattern `servicerole` had no underscore, and the two never
> matched — so the one credential granting full database access was the one being logged in clear
> text. Both sides now reduce to bare letters. Written down because the next person adding a
> pattern needs to know why the normalisation looks like that.

Personal data is held to a stricter line than secrets: Sentry receives a **user id only**, never a
name or email, because CC-64 grants a right to erasure that cannot reach a third-party error
tracker once the data is copied into it. Paths are sent, never query strings.

### Frontend/backend correlation

The backend stamps `x-request-id` on every response. The axios response interceptor records the
latest one, and a frontend error report carries it as a tag. One id locates both sides — which is
what we buy instead of breadcrumbs.

### New modules

**Backend**

| File | Responsibility |
|---|---|
| `src/services/observability/requestContext.ts` | AsyncLocalStorage context |
| `src/services/observability/logger.ts` | Structured logging, redaction |
| `src/services/observability/sentry.ts` | Envelope reporter |
| `src/middleware/observability.ts` | `requestLogger`, `errorHandler`, `notFoundHandler` |

**Frontend**

| File | Responsibility |
|---|---|
| `src/lib/observability.ts` | Reporter, request-id capture, global handlers |
| `src/components/app/ErrorBoundary.tsx` | Render error recovery UI |

`ErrorBoundary` is a class component. `componentDidCatch` has no hook equivalent and React has not
shipped one — this is the documented exception to the hooks-only rule elsewhere.

### Middleware order, which is easy to get wrong

```ts
app.use(requestLogger);   // FIRST: even a helmet/CORS rejection gets an id
app.use(helmet());
app.use(cors(...));
app.use(routes);
app.use(notFoundHandler); // AFTER routes, or it swallows all of them
app.use(errorHandler);    // LAST, and must keep 4 params
```

`errorHandler` must stay four-argument: Express identifies an error handler by arity, so deleting
the unused `_next` silently turns it back into ordinary middleware and every error goes unhandled
again. There is a comment on the parameter saying so.

### Why the Sentry send is awaited

A Vercel lambda freezes the instant the response is flushed, so a fire-and-forget POST frequently
never leaves the machine — the same reason CC-03 puts email in a durable outbox. Errors are rare
enough that a bounded wait on the error path is acceptable where it would not be per-request.
`SENTRY_TIMEOUT_MS` bounds it; the call never throws.

The browser uses `keepalive: true` for the same reason: the error may be what made the user close
the tab.

## Configuration

| Var | Repo | Purpose |
|---|---|---|
| `SENTRY_DSN` | backend | Reporting destination. Absent ⇒ off |
| `SENTRY_ENVIRONMENT` | backend | Defaults to `NODE_ENV` |
| `SENTRY_ENABLED` | backend | `false` always wins |
| `SENTRY_TIMEOUT_MS` | backend | Default 2000 |
| `LOG_LEVEL` | backend | `debug`\|`info`\|`warn`\|`error`\|`silent` |
| `LOG_JSON` | backend | Defaults to on in production |
| `VITE_SENTRY_DSN` | frontend | Public by design |
| `VITE_SENTRY_ENVIRONMENT` | frontend | Defaults to Vite's `MODE` |

A malformed `SENTRY_DSN` makes the process refuse to start. The symptom otherwise is silence —
errors simply never appear, with nothing to explain why.

> **Note on the name.** The `.env` in this project carried `SENTRY_DSN_API_KEY`, empty, read by
> nothing. Sentry does not issue an "API key" for this: a DSN is a URL with the public key already
> embedded, and unlike an API key it is not secret. Renamed to `SENTRY_DSN` on 2026-09-23.

## Acceptance criteria

All 13 covered by automated tests (53 assertions across `observability.test.ts`,
`errorHandler.test.ts` and the frontend's `observability.test.ts`).

1. Every response carries `x-request-id`.
2. A caller-supplied `x-request-id` is echoed, so external traces join up.
3. A malicious id is sanitised — CRLF stripped, length bounded — so log entries cannot be forged.
4. An unhandled throw returns **JSON**, not HTML.
5. A rejected async handler is caught the same way (Express 5 behaviour, pinned).
6. No stack, message or internal path appears in a production response body.
7. The response still carries the request id, so a student can quote it.
8. A CORS rejection is 403 and is **not** reported — crawlers and stale tabs would flood Sentry.
9. A response that already started is ended, not corrupted with a second body.
10. Unmatched routes return JSON 404, and real routes are not shadowed.
11. Secrets and personal data are redacted, nested as well as top-level.
12. Concurrent requests do not see each other's context.
13. With no DSN, the frontend reporter makes no network call and never throws.

## Test plan

- **Unit:** redaction across every sensitive key shape, depth limit against a cyclic object, string
  and array bounds. DSN parsing, event shape, personal-data exclusion. Context isolation under real
  concurrency.
- **Integration:** a real Express app through supertest, covering every branch of the error handler.
- **Not testable over HTTP:** the CRLF injection case. Node's own http layer rejects such a header
  before Express sees it, so supertest cannot deliver it — `safeRequestId` is therefore tested
  directly and is defence in depth rather than the only barrier. Recorded because a reader will
  otherwise wonder why one test does not go through the app.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A secret reaches a log through an unlisted key name | Medium | **High** | Broad substring list, bare-letter normalisation, nested walk, tests per shape |
| Sentry free-tier quota exhausted by one error loop | Medium | Low | CORS noise excluded; `SENTRY_ENABLED=false` kills it without a deploy |
| Awaited send adds latency to error responses | High | Low | Only on the error path, bounded by `SENTRY_TIMEOUT_MS` |
| `errorHandler` loses its 4th parameter in a refactor | Low | **High** | Commented on the parameter; tests fail loudly |
| Stacks point at compiled output | Certain | Low | Accepted — the request id is the real correlation |

## Rollback

Pure addition; no migration. Remove the three `app.use` lines and behaviour returns to the previous
(worse) default. `SENTRY_ENABLED=false` disables reporting alone without a deploy.

## Open questions

1. Should `keep-db-alive` be excluded from request logs? It is hit on a schedule and will dominate
   log volume. Leaning yes, once there is a cron hitting it.
2. Sample successful-request logs at high volume? Not a problem at current traffic; the hook would
   go in `requestLogger`.
3. Should the frontend boundary also wrap each `AppLayout` route individually, so a failure in one
   panel does not blank the page? Deferred until a page is big enough to justify it.
