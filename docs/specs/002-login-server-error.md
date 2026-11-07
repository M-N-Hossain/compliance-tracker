# 002: Tell users when the server fails, not that their password is wrong

**Status:** submitted

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
- As the developer, I want the kind of error (its name and code) written to the server
  log, so that I can find out why it failed.

## Acceptance criteria

The two messages:

- Server failure: "Something went wrong on our side. Please try again in a moment."
- Bad credentials: "Wrong email or password."

Login:

1. Given a wrong password or an unknown email, when `authorize` runs, then it
   returns `null` and nothing is logged as an error.
2. Given the database throws, when `authorize` runs, then the sign-in result is
   not the bad-credentials error, and the error's name and code are logged.
3. Given a sign-in result, when the login page turns it into a message, then the
   bad-credentials error gives "Wrong email or password." and any other error
   gives the server-failure message (a small pure function, so a unit test proves
   it).
4. Given a server failure on the login page, when the message shows, then the
   button is enabled again and the user can submit once more.

Sign-up:

5. Given the database throws, when `POST /api/register` runs, then the response is
   500 with JSON `{ error: "<server-failure message>" }`, and the error's name and
   code are logged.
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
- Done: yes

### Step 4: Register page handles both failures

- Files: `app/(auth)/register/page.tsx`, `test/e2e-test/auth-errors.spec.ts`
- Tests: browser, two tests added to `auth-errors.spec.ts`. First: `/api/register`
  answers 500 with no body, the server-failure message shows and the button is
  enabled again (criterion 6). Second: the account is created but the sign-in is
  answered with a failure, the page stays on `/register` and shows the "account
  was created" message (criterion 7).
- Commit: `fix: show messages on sign-up failures instead of hanging`
- Done: yes

Criteria 8 and 9 (login and sign-up still work) are proven by the existing
`smoke.spec.ts`, which `/test` runs. No new test is needed.

### Step 5: Keep query arguments out of the error logs (review finding 1)

- Files: `lib/verifyCredentials.ts`, `app/api/register/route.ts`,
  `test/util-test/verifyCredentials.test.ts`, `test/api-test/register.test.ts`
- Tests: one added case in each existing test file. The fake database throws an
  error whose message contains the email, as a Prisma error can. The logged text
  must not contain the email or the password. It proves criterion 10 for real
  Prisma-style errors.
- Commit: `fix: keep query arguments out of error logs`
- Done: yes

### Step 6: Stop Auth.js from logging the original error (review finding 12)

- Files: `lib/verifyCredentials.ts`, `test/util-test/verifyCredentials.test.ts`
- Tests: the existing database-error tests change from "rethrows the same error"
  to "throws a new error". The new error's message and stack must not contain the
  email or the password, even when the original message quoted the email (the
  "leaky" case), and it is still not a `CredentialsSignin`. This covers what
  Auth.js prints, because it logs the thrown error's stack. It proves criterion 10
  for the login path.
- Commit: `fix: rethrow a plain error so Auth.js does not log the query`
- Done: yes

## Evidence

Date: 2026-11-07. Commit: 8590fdd.

| Check                                            | Result                    |
| ------------------------------------------------ | ------------------------- |
| `npm run check` (lint, format, types)            | pass                      |
| `npm run test:unit`                              | pass, 12 files, 108 tests |
| `npm test` (all Vitest, with the test database)  | pass, 16 files, 157 tests |
| `npm run test:e2e`                               | pass, 17 tests            |
| `node test/hook-test/block-destructive.test.mjs` | pass, 64 of 64            |

| Criterion | Result | Evidence                                                                                                                                                              |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | pass   | `verifyCredentials.test.ts`: wrong password and unknown email return null, `console.error` not called                                                                 |
| 2         | pass   | `verifyCredentials.test.ts`: "throws on a database error and logs its name and code", and the thrown error is not `CredentialsSignin`                                 |
| 3         | pass   | `authMessages.test.ts`: `CredentialsSignin` gives the bad-credentials message, others the server one                                                                  |
| 4         | pass   | `auth-errors.spec.ts`: server failure on login shows the server message and the button is enabled                                                                     |
| 5         | pass   | `register.test.ts`: database failure gives 500, JSON server message, name and code logged                                                                             |
| 6         | pass   | `auth-errors.spec.ts`: sign-up answer with no body shows the server message, button enabled                                                                           |
| 7         | pass   | `auth-errors.spec.ts`: failed automatic sign-in stays on `/register` with the "account created" text                                                                  |
| 8         | pass   | `smoke.spec.ts`: login after sign-out reaches the app (setup page, then dashboard)                                                                                    |
| 9         | pass   | `smoke.spec.ts`: sign-up reaches `/company/setup`                                                                                                                     |
| 10        | pass   | "keeps the email out of the log even when the error message quotes it" in `verifyCredentials.test.ts` (log, thrown message and stack) and in `register.test.ts` (log) |

Security checklist tests: the spec requires none beyond criterion 10. The cross-tenant test is not applicable, because no company data is touched.

Notes:

- Criterion 8: the spec says `/dashboard`. A user with no company is sent on to `/company/setup`, and the smoke test reaches the dashboard after company setup. Login itself is proven.
- Criteria 4, 6 and 7 stage the failure in the browser, and no real-browser walk (`/ui-test`) has run yet. The real error value for a database outage (`error=Configuration`) was seen once on a live app in Step 1, before Step 6 changed what `authorize` throws. A plain `Error` is still not `CredentialsSignin`, so the same path applies, but it was not rerun live.
- Criterion 10: the leaky-error tests use a fake error that quotes the email. A real Prisma error was not produced in this run, and what Auth.js itself prints was proven only through the thrown error's message and stack, not by reading the live log.

## Review

Date: 2026-11-07. Commit: 082b81f.

| Review   | Result                                              |
| -------- | --------------------------------------------------- |
| Spec     | ran (review-code subagent), no blockers             |
| Bug      | ran (`code-review`)                                 |
| Security | ran (`security-review`), no finding at confidence 8 |

| #   | Severity | File and line                                | Finding                                                                                                                                           | Source              | Decision                                                                          |
| --- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| 1   | major    | `lib/verifyCredentials.ts:20`, `route.ts:36` | The raw error object is logged. Prisma errors can contain the query arguments, which could put the email in the log.                              | Spec, Bug, Security | fixed in Step 5                                                                   |
| 2   | major    | `test/api-test/register.test.ts`             | The 409 and success returns moved inside the `try`, and no unit test covers them (only the smoke test covers success).                            | Spec                | issue #13                                                                         |
| 3   | minor    | `app/api/register/route.ts:8`                | `await request.json()` is outside the `try`, so a malformed body still gives an empty 500.                                                        | Bug, Spec           | issue #12                                                                         |
| 4   | minor    | `login/page.tsx:21`, `register/page.tsx:22`  | `signIn` and `fetch` are not in a try/catch, so a network failure leaves the button stuck.                                                        | Bug                 | issue #12                                                                         |
| 5   | minor    | `app/api/register/route.ts:35`               | Two sign-ups with the same email at once give a 500 "try again" instead of 409, because the unique-constraint error is caught.                    | Bug                 | issue #14                                                                         |
| 6   | minor    | `test/e2e-test/auth-errors.spec.ts`          | No automated test links a real `authorize` throw to `Configuration`. The browser tests stub it, and the port 3100 and message text are hardcoded. | Bug, Spec           | issue #13                                                                         |
| 7   | minor    | `lib/authMessages.ts:11`                     | Every error other than `CredentialsSignin` is shown as a server failure.                                                                          | Bug                 | declined: the Credentials provider only gives CredentialsSignin or a thrown error |
| 8   | minor    | `lib/verifyCredentials.ts:18`                | A database failure is logged twice, once by us and once by Auth.js.                                                                               | Bug                 | declined: criterion 2 needs our own log line                                      |
| 9   | minor    | `register/page.tsx:42`                       | After a failed automatic login the form stays filled in, and pressing Create account again shows a 409.                                           | Bug                 | declined: the developer chose to stay on the page (criterion 7)                   |
| 10  | nit      | `app/api/register/route.ts:16-25`            | The re-indented lines inside the `try` have no comments (CLAUDE.md asks for one on every part).                                                   | Spec                | declined: moved lines, not new code                                               |
| 11  | nit      | `docs/specs/002-login-server-error.md:3`     | The status still says approved although all steps are done.                                                                                       | Spec                | declined: /pr updates the status                                                  |

Notes: the spec reviewer marked criteria 8, 9 and 10 "unsure" only because it did not run the tests. `/test` proved them in its own run (see Evidence).

### Round 2

Date: 2026-11-07. Commit: a54c8b4.

| Review   | Result                                              |
| -------- | --------------------------------------------------- |
| Spec     | ran (review-code subagent), no blockers             |
| Bug      | ran (`code-review`)                                 |
| Security | ran (`security-review`), no finding at confidence 8 |

| #   | Severity | File and line                                      | Finding                                                                                                                                                     | Source | Decision                                                        |
| --- | -------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| 12  | major    | `lib/verifyCredentials.ts:24`                      | The original error is rethrown, and Auth.js logs its stack, which starts with the message. A Prisma error quoting the email still reaches the log at login. | Bug    | fixed in Step 6                                                 |
| 13  | minor    | `lib/verifyCredentials.ts:21`, `route.ts:35`       | Some real errors have no `code` or a generic name, so the log could read "Error undefined". No test shows what a real database outage logs.                 | Spec   | issue #13 (comment)                                             |
| 14  | minor    | `test/api-test/register.test.ts`                   | `beforeEach` resets `findUnique` but not `create`, which will leak between tests once success tests are added.                                              | Spec   | issue #13 (comment)                                             |
| 15  | minor    | `verifyCredentials.test.ts`, `auth-errors.spec.ts` | A few tests have no comment of their own (CLAUDE.md asks for one on every part).                                                                            | Spec   | issue #13 (comment)                                             |
| 16  | minor    | `lib/verifyCredentials.ts:21`, `route.ts:35`       | The "log only name and code" block is copied into two files.                                                                                                | Bug    | declined: two small copies, and the fix for 12 changes only one |
| 17  | nit      | `docs/specs/002-login-server-error.md`             | The Review section named an older commit and did not say that Step 5 got a second review.                                                                   | Spec   | declined: round 2 records the right commit                      |

Repeats of round 1, already decided and not listed again: the duplicate sign-up race (issue #14), `request.json()` outside the `try` and the missing try/catch around `fetch` and `signIn` (issue #12), the stubbed browser tests and port 3100 (issue #13), the form staying live after a failed automatic login (declined), and the mapping of every non-`CredentialsSignin` error to the server message (declined).

The spec reviewer marked criteria 8 and 9 "unsure" only because it did not run the tests. `/test` proved them in its own run (see Evidence).

### Round 3

Date: 2026-11-07. Commit: f011b98.

| Review   | Result                                              |
| -------- | --------------------------------------------------- |
| Spec     | ran (review-code subagent), no blockers             |
| Bug      | ran (`code-review`)                                 |
| Security | ran (`security-review`), no finding at confidence 8 |

| #   | Severity | File and line                                     | Finding                                                                                                                               | Source | Decision                                                                 |
| --- | -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| 18  | minor    | `lib/verifyCredentials.ts:25`                     | The thrown message is built from `name` and `code` without checking them. A driver error could in theory carry input in either value. | Spec   | declined: both values come from the database driver, not from user input |
| 19  | minor    | `test/util-test/verifyCredentials.test.ts`        | No test asserts directly that the thrown error is not a `CredentialsSignin`. It follows from the exact message check.                 | Spec   | issue #13 (comment)                                                      |
| 20  | minor    | `test/util-test/verifyCredentials.test.ts`        | No test fails if a `cause` is added to the thrown error later, although Auth.js can print causes.                                     | Spec   | issue #13 (comment)                                                      |
| 21  | minor    | `docs/specs/002-login-server-error.md` (Step 1)   | Step 1 still says the database error is "rethrown", while Step 6 changed it to a new error.                                           | Spec   | declined: a running spec stays as written, Step 6 records the change     |
| 22  | nit      | `docs/specs/002-login-server-error.md` (Evidence) | The Evidence names commit 8590fdd, and the branch head is f011b98, a docs-only commit.                                                | Spec   | declined: f011b98 is docs only, 8590fdd is the last code commit          |
| 23  | nit      | `test/util-test/authMessages.test.ts`             | The test includes an empty error string, which the login page never passes (it only calls the function inside `if (result?.error)`).  | Bug    | declined: a harmless extra case for unknown input                        |

Repeats of rounds 1 and 2, already decided and not listed again: no try/catch around `fetch` and `signIn` and `request.json()` outside the `try` (issue #12), the duplicate sign-up race (issue #14), name and code that can be undefined and the stubbed browser tests with port 3100 (issue #13), the copied log block, the form staying live after a failed automatic login and the mapping of every non-`CredentialsSignin` error (all declined).

The spec reviewer marked criteria 8 and 9 "unsure" only because it did not run the tests. `/test` proved them in its own run (see Evidence).
