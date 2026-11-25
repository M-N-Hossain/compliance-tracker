# 005: Let the user pick a business type when the AI classification fails

**Status:** building

**Type:** slice

**Depends on:** none

## Problem

In production on the Gemini free tier, the classify call fails often (429 quota,
503 overloaded). `/api/company/classify` then returns 502 and `CompanySetupForm`
shows an error on "Step 2 of 2" with no way forward. The business type picker only
appears after a successful classify, so a new user cannot create a company at all.
The 502 response also does not carry the list of categories, even though the route
has already loaded it before it calls Gemini.

## User stories

- As a new user, I want to choose my business type myself when the AI suggestion
  fails, so that I can still create my company.
- As a new user, I want nothing chosen for me in that case, so that I do not get a
  wrong checklist by accident.

## Acceptance criteria

Message shown on fallback: "The AI suggestion is not available right now. Choose
your business type yourself."

1. Gemini throws (for example a 429): `POST /api/company/classify` returns 502 with
   JSON `{ error, categories }`, and `categories` is the list from the database,
   without "general".
2. Gemini answers with a category that is not in the list (the "Could not classify"
   case): 502 with `categories` as well.
3. A 400 (description too short) or 401 returns no `categories`, as today.
4. Browser, classify answers 502 with `categories`: the form moves to "Business
   type" and shows the fallback message.
5. In that fallback, the dropdown shows the disabled placeholder "Choose a business
   type" and "Save and build my checklist" is disabled. After the user picks a
   type, Save is enabled.
6. In the fallback, the user picks a type and saves: `POST /api/company` is called
   with that category and the user reaches `/dashboard` with that category's
   checklist.
7. Browser, classify answers 400 or 401: the form stays on the description step
   and shows the server's error text, with no fallback and no dropdown. If the
   classify fetch itself fails (network error), the button leaves "Thinking...",
   is enabled again, and an error message shows.
8. In the fallback, the user edits the description and presses "Suggest a business
   type" again: the form works as before (a later success preselects the AI's
   suggestion, a later 502 shows the fallback again, with no category left over).
9. `generateWithRetry` makes at most 3 Gemini calls per request: when every call
   fails with a 503, the fake Gemini is called exactly 3 times, then the error is
   thrown. A 429 is still not retried (1 call).
10. `POST /api/company` still rejects "general" and an unknown category with 400
    (existing behaviour, not changed). No test covers it today, so this slice adds
    one database API test.

## Security checklist

- **Auth and ownership:** `classify` already checks the session at the top and
  loads no company data. `POST /api/company` is not changed and keeps its own
  session check, its one-company-per-user check, and its server-side category
  check (must exist, must not be "general"). The fallback goes through that same
  route, with no bypass.
- **Cross-tenant test:** Not applicable, because no company record is read or
  written by a new path. The only write is the existing `POST /api/company`, which
  creates the caller's own company.
- **AI boundary:** model output is still never saved before the user confirms it.
  In the fallback there is no model output at all. The categories sent in the 502
  come from the database, not from the model. Nothing is rendered as HTML.
- **R2 files:** Not applicable, because no file is stored or served.
- **Roles:** Not applicable, because any logged-in user without a company may do
  this, as today.
- **Rate limits:** the classify call costs Gemini quota. `generateWithRetry` retried
  a 503 up to 3 times, so one click made up to 4 Gemini calls, all counting against
  the free per-minute quota. This slice lowers the default `maxRetries` in
  `lib/gemini.ts` from 3 to 2, so one click makes at most 3 calls (criterion 9).
  The default is shared, so the document upload extraction also drops from 4 to 3
  calls. That is intended. No new limit per user is added.
- **Personal data:** the company name and description are typed by the user and sent
  as before. Tests use synthetic data only, never the real Gemini, never `.env`.

## Out of scope

Rate limiting on login and register. A demo login. A privacy or "do not upload real
documents" notice. A "Try the AI again" button. Any change to the retry behaviour in
`lib/gemini.ts` other than the lower retry count (no new delay rules, no retry on
429). Any change to `/api/company`, the Dockerfile, compose files, the Caddyfile or
any `.env`. Each is a separate slice or issue.

Checked, not a problem: when upload returns `extracted: null`, `components/uploadForm.tsx`
already starts with an empty form (line 26), so no issue is needed.

## Limits and tests (planned)

- Screen change: yes (`CompanySetupForm`). `/ui-test` is skipped by the
  developer's decision. This goes against the workflow rule (a screen file changes
  and criteria 4 to 8 wait for the browser), so the browser test below is the only
  browser proof, and layout and wording are not checked by eye. `/test`,
  `/review-changes` and `/pr` still run.
- API test (criteria 1, 2, 3): `test/api-test/classify.test.ts`, with `@/auth`,
  `@/lib/prisma` and `generateWithRetry` faked. Gemini throws a 429-like error.
- Retry test (criterion 9): `test/api-test/gemini-retry.test.ts`, with a dummy key,
  the `@google/genai` SDK faked and timers faked, so no real call and no real wait.
- Database API test (criterion 10): `test/api-test/company.db.test.ts`, against the
  test database, for "general" and an unknown category.
- Browser test (criteria 4 to 8): `test/e2e-test/classify-fallback.spec.ts`, with
  `/api/company/classify` mocked by `page.route`. Because `/ui-test` is skipped,
  criterion 8 (ask again after a fallback) is in this file too.

## Steps

### Step 1: At most 3 Gemini calls per request

- Files: `lib/gemini.ts` (default `maxRetries` from 3 to 2, comment the why: the
  free per-minute quota), `test/api-test/gemini-retry.test.ts` (new).
- Tests: API-level test with a dummy key, the `@google/genai` SDK faked and fake
  timers. Every call fails with a 503: the fake is called exactly 3 times, then the
  error is thrown. A 429 is called once and thrown (criterion 9).
- Commit: `fix: limit Gemini to 3 calls per request`. Done: yes.

### Step 2: Classify returns the categories when the AI fails

- Files: `app/api/company/classify/route.ts` (both 502 responses include
  `categories`), `test/api-test/classify.test.ts` (new).
- Tests: API test with `@/auth`, `@/lib/prisma` and `generateWithRetry` faked, no
  real Gemini. Gemini throws a 429-like error: 502 with `error` and the
  `categories` list, without "general" (criterion 1). Gemini answers a category
  not in the list: 502 with `categories` (criterion 2). A description under 10
  characters gives 400, and no session gives 401, both without `categories`
  (criterion 3).
- Commit: `feat: return categories when the AI classification fails`. Done: yes.

### Step 3: Manual business type on the setup form

- Files: `app/(onboarding)/company/setup/CompanySetupForm.tsx` (a 502 with
  `categories` moves to the confirm step with the fallback message, empty category,
  disabled placeholder "Choose a business type", Save disabled until a type is
  chosen; 400 and 401 show the server error with no fallback; `try/finally` around
  `setLoading`, and a catch that shows an error when the fetch or `res.json()`
  throws), `test/e2e-test/classify-fallback.spec.ts` (new).
- Tests: browser tests with `/api/company/classify` mocked by `page.route`, never
  the real Gemini. 502 with categories: message shown, placeholder shown, Save
  disabled, then enabled after a pick (criteria 4, 5). Pick, save, reach
  `/dashboard` with that category's checklist, through the real `/api/company`
  (criterion 6). 400 and 401: error text, no dropdown. Aborted request: error
  shown and the button is back to "Suggest a business type" (criterion 7). Fallback,
  then edit the description and ask again, once with a 200 and once with a 502:
  suggestion preselected, or fallback again with no leftover category
  (criterion 8).
- Commit: `feat: let the user pick a business type when the AI fails`. Done: yes.

### Step 4: Prove the server still checks the category

- Files: `test/api-test/company.db.test.ts` (new). No product code changes.
- Tests: database API test against the test database, with `@/auth` faked and
  synthetic data. `POST /api/company` with category "general" gives 400, and with
  an unknown category gives 400, and no company is created in either case
  (criterion 10).
- Commit: `test: check that company creation rejects bad categories`. Done: yes.

## Evidence and review

Not run yet. Full tables and findings: docs/evidence/005-classify-manual-fallback.md.
