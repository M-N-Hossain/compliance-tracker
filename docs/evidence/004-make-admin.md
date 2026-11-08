# 004 evidence and review

Test results and review findings for the spec at
[docs/specs/004-make-admin.md](../specs/004-make-admin.md). The spec keeps the
plan and a short result. This file keeps the proof.

## Evidence

Date: 2026-11-08. Commit: 1dd308b.

| Check                                            | Result           |
| ------------------------------------------------ | ---------------- |
| `npm run check` (lint, format, types)            | pass, exit 0     |
| `npm run test:unit`                              | pass, 112 of 112 |
| `npm test` (all Vitest, test database)           | pass, 175 of 175 |
| `npm run test:e2e`                               | pass, 18 of 18   |
| `node test/hook-test/block-destructive.test.mjs` | pass, 64 of 64   |

| Criterion | Result | Evidence                                                                                            |
| --------- | ------ | --------------------------------------------------------------------------------------------------- |
| 1         | pass   | `promote.db.test.ts` > "makes the user an admin and says they must log in again"                    |
| 2         | pass   | `promote.db.test.ts` > "answers already-admin for a user who is already an admin"                   |
| 3         | pass   | `promote.db.test.ts` > "answers 404 for an unknown email, without repeating it, and changes nobody" |
| 4         | pass   | `promote.db.test.ts` > "answers 400 for ..." (no email, empty email, not a string, not JSON)        |
| 5         | pass   | `promote.db.test.ts` > "answers 401 with no login, and the target stays a non-admin"                |
| 6         | pass   | `promote.db.test.ts` > "answers 403 to a non-admin, ..." and "... who tries to promote themselves"  |
| 7         | pass   | `promote-token.db.test.ts` > "answers 403 when the token says admin but the database does not"      |
| 8         | pass   | `promote.db.test.ts` > "logs one line with both user ids and no email"                              |
| 9         | pass   | `promote.test.ts` > "answers 500 with JSON when the login check fails / the user lookup fails, ..." |

Notes:

- 2: "nothing changes" is checked as `isAdmin` staying `true`. `User` has no
  updated-at column, so a needless write would not show.
- 7: in Step 2 the test was also run once against a route that trusted the token,
  where it failed with 403 expected and 200 received. That run is from the build,
  not this one.
- 9: the database error is a fake whose message quotes an email, not a real
  Prisma error.
- `test:e2e`: the server log showed "The destination stream errored while
  writing data." three times, right after `auth-errors.spec.ts` test 3 (from spec
  002), with no test failing. The cause was not checked.

Security checklist: the mandatory tests are criteria 6 and 7, and both ran and
pass. The cross-site request item now has a test too: review finding F1 (Step 5)
is proven by `promote.db.test.ts` > "answers 415 for a JSON body sent as
text/plain, and changes nobody", which ran and passes.

## Review

### Round 1

Date: 2026-11-08. Commit: 6c5c0cf.

| Review   | Result                                     |
| -------- | ------------------------------------------ |
| Spec     | ran                                        |
| Bug      | ran, no findings outside the saved diff    |
| Security | ran, no findings at confidence 8 or higher |

| #   | Severity | File and line                         | Finding                                                                                                                                                                                                                                                                                                                            | Source    | Decision        |
| --- | -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------- |
| F1  | major    | `app/api/admin/promote/route.ts:31`   | The body is parsed as JSON whatever its `Content-Type`, so a `text/plain` POST, which needs no preflight, is accepted. `SameSite=Lax` still sends the cookie from a same-site origin (another port on localhost, a sibling subdomain), so such a page can make an admin's browser promote anyone. The spec's checklist missed this | Bug, Spec | fixed in Step 5 |
| F2  | minor    | `app/api/admin/promote/route.ts:41`   | Read, check, then write in separate calls: two admins promoting the same user at once both answer "promoted" and log twice, and a user deleted in between gives 500 instead of 404. One conditional `updateMany` would avoid it                                                                                                    | Bug       | issue #25       |
| F3  | minor    | `test/api-test/promote.db.test.ts:74` | The already-admin test cannot fail on a needless write; a spy on `prisma.user.update` would prove "nothing changes"                                                                                                                                                                                                                | Spec      | issue #26       |
| F4  | minor    | `test/api-test/promote.db.test.ts:85` | The 404 test does not check that no row was created for the unknown email                                                                                                                                                                                                                                                          | Spec      | issue #26       |
| F5  | minor    | `test/api-test/promote.db.test.ts:52` | The log test spies only on `console.info`, so an email logged with another console method would pass                                                                                                                                                                                                                               | Spec      | issue #26       |
| F6  | minor    | `app/api/admin/promote/route.ts:13`   | The catch keeps only name and code for every error, so a code bug loses its message and stack; the same snippet now exists in four files                                                                                                                                                                                           | Bug       | issue #27       |
| F7  | minor    | `app/api/admin/promote/route.ts:25`   | 403 attempts by non-admins leave no trace in the log                                                                                                                                                                                                                                                                               | Bug       | issue #25       |
| F8  | nit      | `app/api/admin/promote/route.ts:21`   | `getCurrentUser()` joins the company, which this route never reads                                                                                                                                                                                                                                                                 | Bug       | declined: nit   |
| F9  | nit      | `test/api-test/promote.test.ts:36`    | A throwing `update` is not tested; the shared try covers it in the code                                                                                                                                                                                                                                                            | Spec      | declined: nit   |

Outside this branch's diff: the existing route `app/api/admin/pending/[id]/route.ts`
has the same `Content-Type` gap as F1, sent to issue #28.

### Round 2

Date: 2026-11-08. Commit: d7086fb.

| Review   | Result                                                                     |
| -------- | -------------------------------------------------------------------------- |
| Spec     | ran                                                                        |
| Bug      | ran, one finding set aside (see below)                                     |
| Security | ran, no findings at confidence 8 or higher; found no way around the F1 fix |

| #   | Severity | File and line                               | Finding                                                                                                                                                                                              | Source    | Decision        |
| --- | -------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------- |
| F10 | minor    | `docs/specs/004-make-admin.md:38`           | Criterion 4 says a body that is not JSON gets 400, but a body not sent as `application/json` now gets 415, and no criterion states the 415, so criterion 4 read literally no longer matches the code | Spec      | fixed in Step 6 |
| F11 | minor    | `app/api/admin/promote/route.ts:29`         | The F1 fix relies on the app never granting a CORS preflight, and nothing enforces that; an Origin or `Sec-Fetch-Site` check would not depend on it                                                  | Bug       | issue #28       |
| F12 | minor    | `test/api-test/promote.db.test.ts:117`      | Only `text/plain` is tested for 415; form-encoded, multipart, a missing header, and an accepted `application/json; charset=utf-8` are not                                                            | Bug, Spec | issue #26       |
| F13 | nit      | `app/api/admin/promote/route.ts:33`         | The exact match refuses `+json` media types, and the 415 answer has no `Accept-Post` header                                                                                                          | Bug       | declined: nit   |
| F14 | nit      | `app/api/admin/promote/route.ts:29`         | The comments cite "Review finding F1", a label that only means something inside this spec's evidence file                                                                                            | Bug       | declined: nit   |
| F15 | nit      | `test/api-test/promote-token.db.test.ts:31` | This test still sends `text/plain`, so its 403 depends on the role check running before the content-type check                                                                                       | Spec      | declined: nit   |
| F16 | nit      | `test/api-test/promote.db.test.ts:15`       | The helper comment "Sends any body at all" no longer fits, because it now sets a JSON type by default                                                                                                | Spec      | declined: nit   |

Repeats of round 1 findings dropped: 0.

Set aside, outside this branch's diff: the bug review found the same same-site
request gap in `app/api/company/route.ts`, `app/api/company/classify/route.ts`
and `app/api/documents/route.ts`. The documents route takes multipart uploads, so
a `Content-Type` check cannot protect it; one shared Origin check could. Issue
#28 was widened to cover all of these routes.
