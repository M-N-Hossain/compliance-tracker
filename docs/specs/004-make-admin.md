# 004: Route for an admin to make another user an admin

**Status:** tested

**Type:** slice

**Depends on:** none

## Problem

The only way to make a user an admin today is to set `isAdmin` by hand in the
database. That needs database access, is easy to get wrong, and leaves no trace
of who did it. An admin should be able to do it from inside the app.

This is slice 1 of 3. It adds the route and its security tests. Next come a
design spec for an admin "Users" screen and a slice that builds that screen on
top of this route. Until then, the route is called from the browser console
while logged in as an admin.

## User stories

- As an admin, I want to make another user an admin by their email, so that I
  do not have to edit the database.
- As the developer, I want to see in the log which admin promoted which user.

## Acceptance criteria

Route: `POST /api/admin/promote` with the body `{ "email": "<user email>" }`.

1. Given a logged-in admin and the email of a user who is not an admin, when the
   route is called, then it answers 200 with `{ "status": "promoted" }` and a
   message that the user must log out and in again, and that user's `isAdmin` is
   `true` in the database.
2. Given the email of a user who is already an admin, then it answers 200 with
   `{ "status": "already-admin" }`, and nothing in the database changes.
3. Given an email that matches no user, then it answers 404 with an error, and
   nothing in the database changes.
4. Given a body sent as `application/json` with a missing, empty or non-string
   email, or that is not valid JSON, then it answers 400 with an error, and
   nothing in the database changes.
5. Given no login, then it answers 401, and the target user stays a non-admin.
6. Given a logged-in user who is not an admin, then it answers 403, and the
   target user stays a non-admin. This holds when the target is the caller
   themselves.
7. Given a session token that still says admin, but the database says the user
   is not an admin, then it answers 403. The check uses the database, not the
   token.
8. On a promotion, the server log has one line with the admin's user id and the
   promoted user's id, and no email.
9. Given the database throws, then it answers 500 with a JSON error, and the log
   has the error's name and code, not its message.
10. Given a body that is not sent as `application/json`, such as `text/plain`,
    then it answers 415, and the target user stays a non-admin.

## Data changes

No schema change and no migration: `User.isAdmin` already exists. The route only
sets `isAdmin` to `true` on one existing row. Risk: a wrong email makes the wrong
user an admin, and this slice cannot undo it, because removing admin is out of
scope. Until then, it is undone by hand in the database.

## Security checklist

- **Auth and ownership:** one new route handler, `app/api/admin/promote/route.ts`.
  It checks login and admin itself with `getCurrentUser()`, which reads the user
  from the database. `proxy.ts` does not cover `/api/admin`, so the route must
  not rely on it. Criteria 5, 6 and 7 prove the checks.
- **Cross-tenant test:** admins act across all companies by design, so the
  tenant risk here is a non-admin promoting anyone. Criterion 6's test, "a
  non-admin gets 403 and the target stays a non-admin", is the mandatory
  security test, together with criterion 7's.
- **AI boundary:** not applicable, because the route never calls Gemini or shows
  model output.
- **R2 files:** not applicable, because the route stores and serves no files.
- **Roles:** admins only, checked against the database on every call
  (criterion 7). A stale token cannot grant admin rights to the route.
- **Rate limits:** no paid call. Rate limiting is out of scope (issue #9).
- **Personal data:** the request holds an email. The log holds user ids only
  (criterion 8), and error answers never echo the email. Tests use synthetic
  emails only.
- **Cross-site requests:** Auth.js sets the session cookie to `SameSite=Lax`
  (its default, `@auth/core` `defaultCookies`, not overridden in `auth.ts`), which
  keeps it off POSTs from other sites. But the browser counts other ports on
  localhost and sibling subdomains as the same site, and a `text/plain` POST
  needs no preflight. So the route also answers 415 unless the body is sent as
  `application/json`, which another origin can only send after a preflight that
  this app never allows (review finding F1, Step 5).

## Out of scope

- The admin "Users" screen and its design spec (slices 2 and 3).
- Removing admin rights, including the last-admin lockout question.
- Refreshing the session token from the database. A promoted user logs out and
  in once before `/admin` opens for them (its own issue).
- A script for the very first admin, which stays a manual database change.
- An audit table. The log line in criterion 8 is the record for now.
- Case-insensitive email lookup. Emails are matched exactly after trimming
  spaces. Sign-up stores emails as typed (no lowercasing), so the admin must use
  the same case.

## Steps

### Step 1: An admin promotes a user, and nobody else can

- Files: `app/api/admin/promote/route.ts` (new),
  `test/api-test/promote.db.test.ts` (new)
- Tests, all database level, with `logInAs` choosing the caller:
  - an admin promotes a non-admin: 200 "promoted" with the log in again message,
    and `isAdmin` is `true` in the database (criterion 1)
  - no login: 401, and the target stays a non-admin (criterion 5)
  - a non-admin: 403, and the target stays a non-admin, also when the target is
    the caller (criterion 6, the mandatory security test)
- Commit: `feat: let an admin promote a user to admin`
- Done: yes

### Step 2: Prove the admin check reads the database, not the token

- Files: `test/api-test/promote-token.db.test.ts` (new). It replaces `@/auth`
  instead of `getCurrentUser`, so it needs its own file. No product code should
  change, because `getCurrentUser()` already reads the database.
- Tests: database level: a session that says admin for a user the database says
  is not an admin gets 403 (criterion 7).
- Commit: `test: prove the promote route ignores a stale admin token`
- Done: yes

### Step 3: Answer the edge cases

- Files: `app/api/admin/promote/route.ts`, `test/api-test/promote.db.test.ts`
- Tests, all database level:
  - already an admin: 200 "already-admin", and nothing changes (criterion 2)
  - unknown email: 404, and nothing changes (criterion 3)
  - missing, empty or non-string email, or a body that is not JSON: 400, and
    nothing changes (criterion 4)
- Commit: `feat: answer already-admin, unknown and invalid promote requests`
- Done: yes

### Step 4: Log the promotion and handle a database failure

- Files: `app/api/admin/promote/route.ts`, `test/api-test/promote.db.test.ts`,
  `test/api-test/promote.test.ts` (new)
- Tests:
  - database level: a promotion logs one line with both user ids and no email
    (criterion 8)
  - API level, fake `prisma` that throws, as in `register.test.ts`: 500 with a
    JSON error, and the log has the error's name and code, not its message
    (criterion 9)
- Commit: `feat: log promotions and answer database failures on promote`
- Done: yes

### Step 5 (F1): Refuse a body that is not sent as JSON

- Review finding F1: a `text/plain` POST needs no preflight, and `SameSite=Lax`
  still sends the cookie from a same-site origin, so the route must check the
  `Content-Type` itself.
- Files: `app/api/admin/promote/route.ts`, `test/api-test/promote.db.test.ts`,
  `test/api-test/promote.test.ts` (both send `application/json`, as a real
  client does)
- Tests: database level: a JSON body sent as `text/plain` gets 415, and the
  target stays a non-admin.
- Commit: `fix: refuse promote requests not sent as JSON`
- Done: yes

### Step 6 (F10): Make the criteria match the code

- Review finding F10: after Step 5, criterion 4 read literally promised a 400 for
  a body the route now answers with 415, and no criterion stated the 415.
- Files: this spec only. Criterion 4 now says "sent as `application/json`", and
  criterion 10 states the 415.
- Tests: none new. Criterion 10 is proven by Step 5's test, "answers 415 for a
  JSON body sent as text/plain, and changes nobody".
- Commit: `docs: state the 415 answer as a criterion in spec 004`
- Done: yes

## Evidence and review

Full tables and findings:
[docs/evidence/004-make-admin.md](../evidence/004-make-admin.md).

- Tests (commit 6054600, 2026-11-08): `npm run check`, 112 unit tests, 175
  Vitest tests, 18 browser tests and the hook test (64 of 64) pass. All 10
  criteria pass.
- Limits: no screen change, so `/ui-test` is skipped. Criterion 9 uses a fake
  database error. Criterion 2 cannot see a needless write, because `User` has no
  updated-at column.
- Review: two rounds, no blockers, no security finding at confidence 8. Round 1:
  of 9 findings, 1 major was fixed (F1, a cross-site request gap, in Step 5), 6
  went to issues #25, #26 and #27, and 2 nits were declined. Round 2: of 7
  findings, 1 is to fix (F10, criterion 4's wording), 2 went to issues #26 and
  #28, and 4 nits were declined. Issue #28 covers the same gap in other routes.
