# 002: Tell users when the server fails, not that their password is wrong

**Status:** approved

**Type:** slice

**Depends on:** none

## Problem

The login page shows "Wrong email or password." for every failed sign-in. That is
true when `authorize` returns `null`, but it is also shown when the database is
down and `prisma.user.findUnique` throws. A user with the right password is told
they are wrong, and may reset a good password or give up.

The same mix-up exists in the sign-up flow:

- `/api/register` has no error handling. If the database fails, it answers 500
  with no JSON body, the page's `res.json()` throws, and the button stays on
  "Creating account..." forever.
- After a successful sign-up, if the automatic sign-in fails, the page sends the
  user to `/login` with no explanation.

## User stories

- As a user, I want to be told when the server has a problem, so that I do not
  think my password is wrong.
- As a user, I want a wrong password to still say "Wrong email or password.", so
  that I know to retype it.
- As a new user, I want sign-up to show a message and let me try again when the
  server fails, so that the page does not hang.
- As the developer, I want the real error written to the server log, so that I can
  find out why it failed.

## Acceptance criteria

The two messages:

- Server failure: "Something went wrong on our side. Please try again in a moment."
- Bad credentials: "Wrong email or password."

Login:

1. Given a wrong password or an unknown email, when `authorize` runs, then it
   returns `null` and nothing is logged as an error.
2. Given the database throws, when `authorize` runs, then the sign-in result is
   not the bad-credentials error, and the real error is logged.
3. Given a sign-in result, when the login page turns it into a message, then the
   bad-credentials error gives "Wrong email or password." and any other error
   gives the server-failure message (a small pure function, so a unit test proves
   it).
4. Given a server failure on the login page, when the message shows, then the
   button is enabled again and the user can submit once more.

Sign-up:

5. Given the database throws, when `POST /api/register` runs, then the response is
   500 with JSON `{ error: "<server-failure message>" }`, and the real error is
   logged.
6. Given `/api/register` answers with an error that has no JSON body, when the
   register page handles it, then it shows the server-failure message and the
   button is enabled again.
7. Given the account was created but the automatic sign-in fails, when the
   register page handles it, then it stays on the register page and shows "Your
   account was created, but we could not log you in. Please log in." It does not
   redirect silently.

No change for the happy path:

8. Given a correct email and password, when the user logs in, then they still
   reach `/dashboard` (the existing login flow in the browser test still passes).
9. Given a correct sign-up, when the user registers, then they still reach
   `/company/setup`.

Logs:

10. Given any failure above, when the error is logged, then the log line contains
    no email and no password.

To verify in build step 1 (decided with the developer): I believe Auth.js v5
returns `error: "CredentialsSignin"` to `signIn(..., { redirect: false })` when
`authorize` returns `null`, and a different error (such as `"Configuration"`) when
it throws. Confirm this with a real run before relying on it.

## Security checklist

- **Auth and ownership:** `authorize` in `auth.ts` and `POST /api/register` change.
  Both are public by nature (they create the login), so they have no login or
  company check. Neither reads or writes company data.
- **Cross-tenant test:** Not applicable, because no company data is read or
  written.
- **AI boundary:** Not applicable, because no model output is saved or shown.
- **R2 files:** Not applicable, because no files are stored or served.
- **Roles:** Not applicable, because login and sign-up are open to anyone. No role
  is read or changed.
- **Rate limits:** Not applicable to cost, because no paid call is made. Limiting
  login attempts is out of scope and tracked as its own issue.
- **Personal data:** The email address and password are involved. The logs must
  never contain them (criterion 10). The server-failure message must not show the
  internal error text, and unknown email and wrong password must still give the
  same message, so the page never reveals which emails exist. Tests use synthetic
  data only.

## Out of scope

- A "Try again" button. Pressing "Log in" again does the same thing.
- Error handling on other pages and routes. Becomes its own issue and slice.
- A health check route such as `/api/health`. Becomes its own issue and slice.
- Rate limiting login attempts. Becomes its own issue and slice.
- Any change to the database or to how passwords are stored.

## Steps

### Step 1: Log the real error and let a server failure through as a different error

- Files: `lib/verifyCredentials.ts` (new, holds the email and password check
  moved out of `auth.ts`, with a try/catch that logs a safe line and rethrows),
  `auth.ts` (calls it)
- Tests: unit, `test/util-test/verifyCredentials.test.ts`, with a fake `prisma`
  and no Docker. It proves criterion 1 (wrong password and unknown email give
  `null` and log nothing), criterion 2 (a database error is rethrown, not turned
  into `null`, and is logged) and the login half of criterion 10 (the logged
  arguments contain neither the email nor the password). Also a one-off real run
  with the database stopped (`docker compose stop db`) to confirm which `error`
  value the browser gets. This is the "to verify in build step 1" item, and the
  finding goes into the step's explanation.
- Commit: `fix: log database errors at login instead of hiding them`
- Done: yes. Verified: `authorize` returning `null` gives `CredentialsSignin`
  (`@auth/core` callback code, line 236). A thrown error gives `Configuration`
  (seen on the running app with the database down).

### Step 2: Login page shows the right message

- Files: `lib/authMessages.ts` (new, the two messages and a function that turns
  a sign-in error into one of them), `app/(auth)/login/page.tsx`,
  `test/e2e-test/auth-errors.spec.ts` (new)
- Tests: unit, `test/util-test/authMessages.test.ts`, proves criterion 3. Browser,
  `auth-errors.spec.ts`, one test: the sign-in call is answered with a server
  failure in the browser, the server-failure message shows and the button is
  enabled again. It proves criterion 4, which only a browser can show.
- Commit: `fix: show a server error on login instead of wrong password`
- Done: yes

### Step 3: Register route answers a database failure with a clear error

- Files: `app/api/register/route.ts`
- Tests: API, `test/api-test/register.test.ts`, with a fake `prisma` that throws
  and no Docker. It proves criterion 5 (500, JSON body with the server-failure
  message, error logged) and the sign-up half of criterion 10 (no email or
  password in the log).
- Commit: `fix: return a JSON error when sign-up hits a database failure`

### Step 4: Register page handles both failures

- Files: `app/(auth)/register/page.tsx`, `test/e2e-test/auth-errors.spec.ts`
- Tests: browser, two tests added to `auth-errors.spec.ts`. First: `/api/register`
  answers 500 with no body, the server-failure message shows and the button is
  enabled again (criterion 6). Second: the account is created but the sign-in is
  answered with a failure, the page stays on `/register` and shows the "account
  was created" message (criterion 7).
- Commit: `fix: show messages on sign-up failures instead of hanging`

Criteria 8 and 9 (login and sign-up still work) are proven by the existing
`smoke.spec.ts`, which `/test` runs. No new test is needed.
