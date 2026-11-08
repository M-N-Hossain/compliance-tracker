# 004 evidence and review

Test results and review findings for the spec at
[docs/specs/004-make-admin.md](../specs/004-make-admin.md). The spec keeps the
plan and a short result. This file keeps the proof.

## Evidence

Date: 2026-11-08. Commit: 37d7c5c.

| Check                                            | Result                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run check` (lint, format, types)            | pass, exit 0                                                                               |
| `npm run test:unit`                              | pass, 112 of 112                                                                           |
| `npm test` (all Vitest, test database)           | pass, 174 of 174                                                                           |
| `npm run test:e2e`                               | pass, 18 of 18 (rerun after the developer stopped a dev server that blocked the first run) |
| `node test/hook-test/block-destructive.test.mjs` | pass, 64 of 64                                                                             |

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
- `test:e2e`: the first run could not start, because a `next dev` server was
  already running on port 3000 and Next.js allows only one per project folder.
  The rerun passed. Its server log showed "The destination stream errored while
  writing data." three times, with no test failing; the cause was not checked.

Security checklist: the mandatory tests are criteria 6 and 7, and both ran and
pass. The cross-site POST item is a cookie setting (`SameSite=Lax`), checked in
the code during /breakdown, not by a test.

## Review

### Round 1

Date: 2026-11-08. Commit: 6c5c0cf.

| Review   | Result                                     |
| -------- | ------------------------------------------ |
| Spec     | ran                                        |
| Bug      | ran, no findings outside the saved diff    |
| Security | ran, no findings at confidence 8 or higher |

| #   | Severity | File and line                         | Finding                                                                                                                                                                                                                                                                                                                            | Source    | Decision      |
| --- | -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------- |
| F1  | major    | `app/api/admin/promote/route.ts:31`   | The body is parsed as JSON whatever its `Content-Type`, so a `text/plain` POST, which needs no preflight, is accepted. `SameSite=Lax` still sends the cookie from a same-site origin (another port on localhost, a sibling subdomain), so such a page can make an admin's browser promote anyone. The spec's checklist missed this | Bug, Spec | fix           |
| F2  | minor    | `app/api/admin/promote/route.ts:41`   | Read, check, then write in separate calls: two admins promoting the same user at once both answer "promoted" and log twice, and a user deleted in between gives 500 instead of 404. One conditional `updateMany` would avoid it                                                                                                    | Bug       | issue #25     |
| F3  | minor    | `test/api-test/promote.db.test.ts:74` | The already-admin test cannot fail on a needless write; a spy on `prisma.user.update` would prove "nothing changes"                                                                                                                                                                                                                | Spec      | issue #26     |
| F4  | minor    | `test/api-test/promote.db.test.ts:85` | The 404 test does not check that no row was created for the unknown email                                                                                                                                                                                                                                                          | Spec      | issue #26     |
| F5  | minor    | `test/api-test/promote.db.test.ts:52` | The log test spies only on `console.info`, so an email logged with another console method would pass                                                                                                                                                                                                                               | Spec      | issue #26     |
| F6  | minor    | `app/api/admin/promote/route.ts:13`   | The catch keeps only name and code for every error, so a code bug loses its message and stack; the same snippet now exists in four files                                                                                                                                                                                           | Bug       | issue #27     |
| F7  | minor    | `app/api/admin/promote/route.ts:25`   | 403 attempts by non-admins leave no trace in the log                                                                                                                                                                                                                                                                               | Bug       | issue #25     |
| F8  | nit      | `app/api/admin/promote/route.ts:21`   | `getCurrentUser()` joins the company, which this route never reads                                                                                                                                                                                                                                                                 | Bug       | declined: nit |
| F9  | nit      | `test/api-test/promote.test.ts:36`    | A throwing `update` is not tested; the shared try covers it in the code                                                                                                                                                                                                                                                            | Spec      | declined: nit |

Outside this branch's diff: the existing route `app/api/admin/pending/[id]/route.ts`
has the same `Content-Type` gap as F1, sent to issue #28.
