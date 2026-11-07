# 002: Tell users when the server fails, not that their password is wrong

**Status:** submitted

**Type:** slice

**Depends on:** none

## Summary

Login and sign-up now tell a server failure apart from a wrong password, and
sign-up no longer hangs when the database fails. All 10 criteria pass (last code
commit tested: 8590fdd). Open: issues #12, #13, #14. Security: logs never contain
the email or the password.

## Problem

The login page shows "Wrong email or password." for every failed sign-in, also
when the database is down and `findUnique` throws. A user with the right password
is told they are wrong. Sign-up has the same mix-up: `/api/register` has no error
handling, so a database failure gives a 500 with no body, `res.json()` throws and
the button stays on "Creating account..." forever. And when the automatic sign-in
after sign-up fails, the user lands on `/login` with no explanation.

## User stories

- As a user, I want to be told when the server has a problem, so that I do not
  think my password is wrong, and a wrong password still says so.
- As a new user, I want sign-up to show a message and let me retry, so that the
  page does not hang.
- As the developer, I want the error's name and code in the server log.

## Acceptance criteria

Messages: server failure "Something went wrong on our side. Please try again in a
moment." Bad credentials "Wrong email or password."

1. Wrong password or unknown email: `authorize` returns `null`, nothing is logged
   as an error.
2. Database throws: the sign-in result is not the bad-credentials error, and the
   error's name and code are logged.
3. A pure function turns a sign-in error into a message: `CredentialsSignin` gives
   the bad-credentials message, any other error the server one.
4. Server failure on the login page: the message shows and the button is enabled.
5. `POST /api/register` and the database throws: 500 with JSON
   `{ error: <server message> }`, name and code logged.
6. `/api/register` answers an error with no JSON body: the register page shows the
   server message and the button is enabled.
7. Account created but the automatic sign-in fails: the page stays on `/register`
   and shows "Your account was created, but we could not log you in. Please log
   in." No silent redirect.
8. A correct login still reaches `/dashboard` (existing browser test).
9. A correct sign-up still reaches `/company/setup`.
10. For any failure above, the log line has no email and no password.

Item to verify in Step 1 (done): Auth.js v5 gives `CredentialsSignin` when
`authorize` returns `null`, and another error (`Configuration`) when it throws.

## Security checklist

- **Auth:** `authorize` and `POST /api/register` change. Both are public by
  nature and touch no company data, so the cross-tenant test, AI boundary, R2
  files and roles do not apply.
- **Rate limits:** no paid call. Limiting login attempts is out of scope.
- **Personal data:** the logs must never contain the email or password
  (criterion 10). The server message shows no internal error text. Unknown email
  and wrong password give the same message, so emails are not revealed. Tests use
  synthetic data only.

## Out of scope

A "Try again" button (pressing "Log in" does the same). Error handling on other
pages and routes, a health route and rate limiting (each its own issue and
slice). Any change to the database or password storage.

## Steps

### Step 1: Log the real error and let a server failure through

- Files: `lib/verifyCredentials.ts` (new, the check moved out of `auth.ts`),
  `auth.ts`. Tests: unit `verifyCredentials.test.ts` (criteria 1, 2, 10 login).
- Outcome: wrong password or unknown email returns `null` and logs nothing. A
  database error is caught, its name and code are logged, and a new plain `Error`
  is thrown, not the original (changed in Step 6). Verified: `null` gives
  `CredentialsSignin` (`@auth/core` callback, line 236), a throw gives
  `Configuration` (seen live with the database down).
- Commit `fix: log database errors at login instead of hiding them`. Done: yes.

### Step 2: Login page shows the right message

- Files: `utils/authMessages.ts` (new), `app/(auth)/login/page.tsx`,
  `test/e2e-test/auth-errors.spec.ts` (new). Tests: unit `authMessages.test.ts`
  (criterion 3), browser (criterion 4).
- Commit `fix: show a server error on login instead of wrong password`. Done: yes.

### Step 3: Register route answers a database failure

- Files: `app/api/register/route.ts`. Tests: API `register.test.ts` with a fake
  `prisma` (criterion 5, and criterion 10 for sign-up).
- Commit `fix: return a JSON error when sign-up hits a database failure`.
  Done: yes.

### Step 4: Register page handles both failures

- Files: `app/(auth)/register/page.tsx`, `auth-errors.spec.ts`. Tests: two browser
  tests (criteria 6 and 7). Criteria 8 and 9 are proven by `smoke.spec.ts`.
- Commit `fix: show messages on sign-up failures instead of hanging`. Done: yes.

### Review fixes

- Step 5 (finding 1): the fake database throws an error whose message quotes the
  email, and the log must not contain it. Files: `verifyCredentials.ts`,
  `route.ts` and their tests. Commit `fix: keep query arguments out of error
logs`. Done: yes.
- Step 6 (finding 12): Auth.js logs the stack of the thrown error, so the login
  path now throws a new plain error whose message and stack hold no email or
  password. Files: `verifyCredentials.ts` and its test. Commit `fix: rethrow a
plain error so Auth.js does not log the query`. Done: yes.

## Evidence and review

Full tables and findings: [docs/evidence/002-login-server-error.md](../evidence/002-login-server-error.md).

- Tests (commit 8590fdd, 2026-11-07): `npm run check`, 108 unit tests, 157 Vitest
  tests, 17 browser tests and the hook test (64 of 64) pass. All 10 criteria pass.
- Limits: criteria 4, 6 and 7 are proven by browser tests that stage the failure,
  and `/ui-test` never ran. Criterion 10 uses a fake error that quotes the email,
  not a real Prisma error.
- Review: three rounds, no blockers, no security finding at confidence 8. Of 23
  findings, 2 were fixed (F1 in Step 5, F12 in Step 6), 10 went to issues #12,
  #13 and #14, and 11 were declined with a reason.
