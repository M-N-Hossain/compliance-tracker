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

Not run yet. /review-changes adds a "### Round N" heading here for each round.
