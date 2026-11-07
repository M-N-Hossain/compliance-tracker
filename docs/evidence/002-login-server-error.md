# 002 evidence and review

Test results and review findings for [spec 002](../specs/002-login-server-error.md).
The spec keeps the plan and a short result. This file keeps the proof.

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
| 7   | minor    | `utils/authMessages.ts:11`                   | Every error other than `CredentialsSignin` is shown as a server failure.                                                                          | Bug                 | declined: the Credentials provider only gives CredentialsSignin or a thrown error |
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
