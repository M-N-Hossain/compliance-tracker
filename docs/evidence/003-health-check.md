# 003 evidence and review

Test results and review findings for the spec at
[docs/specs/003-health-check.md](../specs/003-health-check.md). The spec keeps the
plan and a short result. This file keeps the proof.

## Evidence

Date: 2026-11-08. Commit: ebbbfd3.

| Check                                            | Result           |
| ------------------------------------------------ | ---------------- |
| `npm run check` (lint, format, types)            | pass, exit 0     |
| `npm run test:unit`                              | pass, 110 of 110 |
| `npm test` (all Vitest, test database)           | pass, 160 of 160 |
| `npm run test:e2e`                               | pass, 18 of 18   |
| `node test/hook-test/block-destructive.test.mjs` | pass, 64 of 64   |

| Criterion | Result | Evidence                                                                                                    |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| 1         | pass   | `health.db.test.ts` > "answers 200 with the up body and is not cached"                                      |
| 2         | pass   | `health.test.ts` > "answers 503 with the down body, is not cached, and logs only the error's name and code" |
| 3         | pass   | `health.test.ts` > "answers 503 with the down body, is not cached, and logs only the error's name and code" |
| 4         | pass   | `health.test.ts` > "answers 503 with the down body after 3 seconds instead of waiting"                      |
| 5         | pass   | `health.db.test.ts` (200) and `health.test.ts` (503 on a throw): `Cache-Control` is `no-store`              |
| 6         | pass   | `health.spec.ts` > "the health check answers without a login"                                               |

Notes:

- 3: the error is a fake whose message quotes a fake host and password, not a
  real `pg` connection error.
- 4: the hang is a fake promise that never settles, and the 3 seconds pass on
  fake timers. A real hung database was not tried.
- 5: the header is checked on the 200 and on the 503 after a throw, not on the
  503 after a timeout. That answer comes from the same `catch` block.
- 6: proven on `next dev`, which Playwright starts, not on the production build.
  The test was also pointed at `/dashboard` once, where it failed with a 307, to
  show it catches a redirect.

Security checklist: no test is required. The cross-tenant test does not apply,
because the route reads no company data. The checklist's limits on what the
answer and the log reveal are criteria 2 and 3, which pass.

## Review

Date: 2026-11-08. Commit: 70bfc95. Round 1.

| Review   | Result                                     |
| -------- | ------------------------------------------ |
| Spec     | ran                                        |
| Bug      | ran                                        |
| Security | ran, no findings at confidence 8 or higher |

| Severity | File and line                       | Finding                                                                                                                                                                    | Source           | Decision                                                         |
| -------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| minor    | `app/api/health/route.ts:21`        | F1: a timed-out check keeps its Pool connection, so probes during a hang can fill the Pool (pg default 10) and hold up other queries after the database recovers           | Bug, Spec, /test | issue #20                                                        |
| minor    | `app/api/health/route.ts:7`         | F2: the root cause is that the shared Pool in `lib/prisma.ts` has no connection or query timeout, so every other route still hangs on a stalled database                   | Bug              | issue #20                                                        |
| minor    | `app/api/health/route.ts:21`        | F3: the 3 seconds include waiting for a free Pool connection, so a busy but healthy database can be reported as down                                                       | Bug              | issue #20                                                        |
| minor    | `test/api-test/health.test.ts:63`   | F4: the hang test only proves an upper limit; it would still pass with a timeout of 0                                                                                      | Bug, Spec        | issue #21                                                        |
| minor    | `test/api-test/health.test.ts:66`   | F5: the timeout answer is not checked for `Cache-Control: no-store` or for its log line                                                                                    | Spec             | issue #21                                                        |
| minor    | `test/e2e-test/health.spec.ts:1`    | F6: the comment says the request goes through `proxy.ts`, but the matcher leaves out `/api/health`, so the proxy never runs; the test guards against a wider matcher later | Spec, Bug        | issue #21                                                        |
| minor    | `app/api/health/route.ts:25`        | F7: with the PrismaPg adapter a connection error is wrapped, so `code` may be missing from the log                                                                         | Bug              | declined: the adapter maps an unreachable database to code P1001 |
| nit      | `test/api-test/health.db.test.ts:1` | F8: the comment says what the file does, not why                                                                                                                           | Spec             | declined: nit                                                    |
| nit      | `app/api/health/route.ts:26`        | F9: on a timeout the log line ends in the word `undefined`, because the error has no code                                                                                  | Spec             | declined: nit                                                    |

Outside this branch's diff: the bug review also reported 4 findings in
`.claude/skills/` (`pr`, `next`, `build`, `review-changes`). Those files are not in
`.review/003.diff`; the review most likely compared against a local `main` that
was behind `origin/main`. They are kept out of this table and went to issue #22.

Notes:

- F7: `node_modules/@prisma/adapter-pg/dist/index.mjs:548-550` turns
  `ECONNREFUSED` and `ENOTFOUND` into `DatabaseNotReachable`, which the Prisma
  runtime maps to `P1001`. Checked in the source, not against a real outage.
