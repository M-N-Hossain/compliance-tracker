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

Not run yet.
