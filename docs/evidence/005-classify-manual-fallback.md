# 005 evidence and review

Test results and review findings for the spec at
[docs/specs/005-classify-manual-fallback.md](../specs/005-classify-manual-fallback.md).
The spec keeps the plan and a short result. This file keeps the proof.

## Evidence

Date: 2026-11-25. Commit: 8a7a59e.

| Check                                            | Result           |
| ------------------------------------------------ | ---------------- |
| `npm run check` (lint, format, types)            | pass, exit 0     |
| `npm run test:unit`                              | pass, 118 of 118 |
| `npm test` (all Vitest, test database)           | pass, 183 of 183 |
| `npm run test:e2e`                               | pass, 23 of 23   |
| `node test/hook-test/block-destructive.test.mjs` | pass, 64 of 64   |

| Criterion | Result | Evidence                                                                                                                                     |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | pass   | `classify.test.ts` > "answers 502 with the categories when Gemini throws a 429"                                                              |
| 2         | pass   | `classify.test.ts` > "answers 502 with the categories when Gemini picks a category that is not on the list"                                  |
| 3         | pass   | `classify.test.ts` > "answers 400 without categories ..." and "answers 401 without categories ..."                                           |
| 4         | pass   | `classify-fallback.spec.ts` > "when the AI fails, the user chooses a business type and reaches the right checklist" (message visible)        |
| 5         | pass   | same test: dropdown value "", placeholder option disabled, Save disabled, then enabled after `selectOption`                                  |
| 6         | pass   | same test: saves through the real `/api/company`, reaches `/dashboard`, shows "Food safety certification (HACCP)", not an accessibility item |
| 7         | pass   | `classify-fallback.spec.ts` > "a 400 ...", "a 401 ..." and "when the request itself fails, the button recovers and an error shows"           |
| 8         | pass   | `classify-fallback.spec.ts` > "asking the AI again after the fallback works as before, and leaves no old choice behind"                      |
| 9         | pass   | `gemini-retry.test.ts` > "calls Gemini 3 times when every call is overloaded (503), then throws" and "does not retry a 429"                  |
| 10        | pass   | `company.db.test.ts` > "answers 400 and creates no company for %s" (general, and a category that does not exist)                             |

Security checklist tests: the cross-tenant test is not required (no new company
data path, see the spec). `company.db.test.ts` ran and passed for the server-side
category check.

Notes:

- Criteria 4 to 8: `/ui-test` was skipped by the developer's decision. The browser
  tests answer `/api/company/classify` in the browser, so they prove the form, not
  the real route. Layout and wording were not checked by eye.
- Criterion 1: the test fakes the database, so "without general" holds for the fake
  list. The route's `where` clause that removes "general" is not exercised here.
- Criterion 7 (400 and 401): the browser test stages these answers. The real route's
  400 and 401 are proven by criterion 3.
- Criterion 9: the Gemini SDK and the timers are fakes, so the real client's 503
  handling is not exercised.

## Review

Not run yet. /review-changes adds a "### Round N" heading here for each round.
