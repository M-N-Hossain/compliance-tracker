# 003: Health check route that reports whether the database is reachable

**Status:** building

**Type:** slice

**Depends on:** none

**Issue:** [#11](https://github.com/M-N-Hossain/compliance-tracker/issues/11)

## Problem

Today the only way to learn that the database is down is a user hitting an error,
as spec 002 showed with login and sign-up. There is no cheap way for the
developer, or a monitor later, to ask "is the app able to reach its database right
now?". The `db` container has a healthcheck (`pg_isready`), but that only says
Postgres is up inside Docker, not that the app can reach it.

## User stories

- As the developer, I want to open `/api/health` and see whether the app can reach
  the database, so that I can spot an outage before a user reports it.
- As a future uptime monitor, I want a status code I can check without logging
  in, so that I can alert on 503.

## Acceptance criteria

1. Given the database is reachable, when `GET /api/health` is called, then it
   answers 200 with exactly `{ "status": "ok", "database": "up" }`.
2. Given the database query throws, when `GET /api/health` is called, then it
   answers 503 with exactly `{ "status": "error", "database": "down" }`.
3. Given the database query throws, then the server log has the error's name and
   code, and not its message or stack, because those can hold the host or the
   connection string.
4. Given the database query does not answer, when `GET /api/health` is called,
   then it answers 503 (same body as criterion 2) after about 3 seconds instead of
   hanging.
5. Every answer has the header `Cache-Control: no-store`, so nothing between the
   app and a monitor can serve an old "ok".
6. Given no login, when `/api/health` is called on the running app, then it gets
   the JSON answer, not a redirect to `/login`.

## Security checklist

- **Auth and ownership:** one new route handler, `app/api/health/route.ts`. It is
  public on purpose (story 2), so it does no login check. It is not in the
  `proxy.ts` matcher, and this slice does not add it. It reads no company data,
  only runs `SELECT 1`.
- **Cross-tenant test:** not applicable, because the route touches no company
  data.
- **AI boundary:** not applicable, because the route never calls Gemini or shows
  model output.
- **R2 files:** not applicable, because the route stores and serves no files.
- **Roles:** anyone, including someone not logged in. Safe because the answer
  holds only two fixed words and a status code: no error text, version, host or
  timing (criteria 2 and 3).
- **Rate limits:** no paid call. Each request runs one `SELECT 1`, which is cheap.
  Rate limiting is out of scope (already its own issue from spec 002).
- **Personal data:** none. Tests use no user data.

## Out of scope

- A Docker healthcheck for the `app` service that uses this route (its own issue).
- Checking R2 or Gemini. Gemini costs money per call.
- Changing the shared Pool settings in `lib/prisma.ts`, such as a connection
  timeout for every query. The timeout in criterion 4 applies only to the health
  check.
- Rate limiting, alerting, a status page or any screen.

## Steps

### Step 1: The route answers up or down

- Files: `app/api/health/route.ts` (new), `test/api-test/health.test.ts` (new),
  `test/api-test/health.db.test.ts` (new)
- Tests:
  - API, real test database (`health.db.test.ts`): answers 200 with the "ok" body
    and `Cache-Control: no-store` (criteria 1 and 5).
  - API, fake `prisma` that throws, as in `register.test.ts` (`health.test.ts`):
    answers 503 with the "error" body and `Cache-Control: no-store` (criteria 2
    and 5). The log has the error's name and code, and not a message that quotes
    a host and password (criterion 3).
- Commit: `feat: add a health check route that reports the database`
- Done: yes

### Step 2: Stop waiting after 3 seconds

- Files: `app/api/health/route.ts`, `test/api-test/health.test.ts`
- Tests: API, fake `prisma` whose query never answers, with fake timers moved 3
  seconds ahead: answers 503 with the "error" body (criterion 4).
- Commit: `feat: stop the health check waiting on a hung database`
- Done: yes

### Step 3: Prove it is public on the running app

- Files: `test/e2e-test/health.spec.ts` (new). No product code should change,
  because `proxy.ts` does not match `/api/health`.
- Tests: end to end, Playwright's `request` with no login: `GET /api/health`
  answers JSON, not a redirect to `/login` (criterion 6). It only checks that the
  route is reachable; the body is already proven in Step 1.
- Commit: `test: prove the health check needs no login`
- Done: yes

## Evidence and review

Not run yet. Limits: no screen change, so `/ui-test` is skipped. Full tables and
findings: docs/evidence/003-health-check.md.
