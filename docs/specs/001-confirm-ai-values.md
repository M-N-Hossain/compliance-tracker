# 001: Save AI values only after the user confirms them

**Status:** approved

## Problem

`POST /api/documents` saves Gemini's `extractedType` and `expiryDate` as soon as a
PDF is uploaded, before anyone has checked them. This breaks the project's AI
boundary rule: the model may suggest, but only the user may decide.

Company users have this problem today:

- A wrong date from Gemini can never be corrected, because the user can only
  change the checklist item.
- That date decides whether the dashboard says Covered, Expiring soon or Expired
  once the document is linked.
- A wrong type becomes the name of the pending request that admins review.

## User stories

- As a company user, I want to check and correct the type and expiry date Gemini
  read, so that my dashboard is based on values I have confirmed.
- As a company user, I want to fill in the values myself when Gemini could not
  read the file or the suggestion is gone, so that I can still use the document.
- As a company user, I want to correct a value after confirming it, so that a typo
  does not stay in my compliance status.
- As an admin, I want pending requests to carry a name the user confirmed, so that
  I do not review unchecked model output.

## Acceptance criteria

Upload saves nothing from the model:

1. Given Gemini returns a type, a date and a match, when a PDF is uploaded, then
   the response is 201 with those values under `extracted`, and the stored document
   has `extractedType`, `expiryDate` and `requirementTemplateId` all null.
2. Given Gemini fails or gives an unusable answer, when a PDF is uploaded, then the
   response is 201, `extracted` is null, the file is stored, and the three fields
   are null.
3. Given a PDF was uploaded, when the user has not confirmed it, then no pending
   request exists for that document.

Confirming saves the user's values:

4. Given a company's own unconfirmed document, when `PATCH /api/documents/:id`
   receives a valid type, date and checklist item, then the response is 200 and all
   three are stored as sent, with the type trimmed.
5. Given a valid body with `expiryDate: null`, when it is sent, then the response is
   200 and the stored `expiryDate` is null.
6. Given a valid body with `requirementTemplateId: null`, when it is sent, then the
   response is 200 and a pending request exists named with the type the user sent,
   not any earlier value.
7. Given a body where any of the three fields is missing, when it is sent, then the
   response is 400 and the document is unchanged. This includes a body with only
   `requirementTemplateId`, the shape the old dropdown sent.
8. Given a type that is not a string, is empty after trimming, or is over 200
   characters, when it is sent, then the response is 400 and the document is
   unchanged.
9. Given an `expiryDate` that is neither null nor a real `YYYY-MM-DD` date, such as
   `2026-02-31`, when it is sent, then the response is 400 and the document is
   unchanged.
10. Given an expiry date in the past, when it is sent, then the response is 200 and
    the date is stored.
11. Given a checklist item outside the company's checklist, when it is sent, then
    the response is 400 and the document is unchanged.

Ownership:

12. Given company A's document, when company B sends a valid body, then the response
    is 404 and the type, date and checklist item are unchanged, and no pending
    request is created.
13. Given another company's document and a document that does not exist, when each
    is sent the same body, then the status and JSON are identical.

Editing after confirming:

14. Given a document with a request in `PENDING_REVIEW`, when the user saves a new
    type, then the request's name becomes that type.
15. Given a document with a request in `APPROVED` or `REJECTED`, when the user saves
    a new type, then the request's name is unchanged.

The screen:

16. Given Gemini returned a type and a date, when the upload finishes, then the
    "Just uploaded" card shows both in editable fields, the suggested checklist item
    is selected, the fields are marked as suggested by AI, and the date shown is the
    date Gemini returned, with no shift from time zones.
17. Given Gemini returned no date, when the upload finishes, then the date field is
    empty and "No expiry date" is not ticked.
18. Given Gemini returned nothing, when the upload finishes, then the card shows
    empty fields and a message saying the file could not be read and the values
    should be filled in by hand.
19. Given the type is empty, or the date is empty and "No expiry date" is not ticked,
    or no checklist item is chosen, when the user looks at the form, then Save is
    disabled.
20. Given an unconfirmed document, when the page is reloaded before confirming, then
    its row says "Not confirmed yet", shows empty fields and a View PDF link, shows
    no AI value, and makes no Gemini call.
21. Given a document with no type stored, when its row is shown, then it no longer
    says "The AI could not read this file".
22. Given a suggestion containing HTML such as `<img src=x onerror=alert(1)>`, when
    it is shown, then it appears as plain text and nothing runs.

Existing data:

23. Given documents with stored AI values, when the data migration runs, then only
    documents with no checklist link and no pending request have their type and date
    cleared. All other documents are unchanged, and no row is deleted.

## Data model and migrations

**Schema:** nothing changes. `extractedType` and `expiryDate` stay, but only the
user's confirm request writes them from now on. The column name `extractedType` no
longer describes its content well. Renaming it is out of scope, to keep the change
small.

**"Confirmed" needs no new column.** It already follows from existing data: a
document is confirmed if it has a checklist link or a pending request. This is the
same test `initialMatchValue` uses for "not decided" (`utils/match.ts`).

**Data migration:** one Prisma migration holding one `UPDATE`, made through
`/safe-migration`:

```sql
UPDATE "Document" d
SET "extractedType" = NULL, "expiryDate" = NULL
WHERE d."requirementTemplateId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PendingRequirement" p WHERE p."documentId" = d.id
  );
```

**Risk to existing data:** the cleared values cannot be restored by rollback. No
row and no PDF is lost, and the user can read the values again from the PDF and
type them in. Documents that are linked or have a pending request keep their values
because the user saw them and acted on them.

The developer confirmed that the local development database is the only one with
real data, so no deployed copy is affected.

## Security

### Auth and company ownership

- **`POST /api/documents` (changed):** keeps its login and company checks. It only
  stops writing model output.
- **`PATCH /api/documents/:id` (changed):** this is the confirm endpoint. It keeps
  its own checks in the handler, not only in `proxy.ts`: 401 when not logged in,
  400 with no company, and a lookup by `id` and `companyId` together that answers
  404 when the document is not theirs. The ownership check runs before the body is
  read.
- **Pending request update (changed):** only reached after the ownership check, and
  it only touches the request linked to that document.

### Cross-tenant test

`gives company B a 404 on company A's document and changes nothing` in
`test/api-test/documents.db.test.ts`, extended to send the new body and to check
type, date and checklist item. Its sibling tests for null and for identical answers
stay and also move to the new body.

### AI boundary

- **Saved before confirming:** nothing. Model output stays in the upload response
  and the browser's memory.
- **Confirm endpoint:** checks the document belongs to the caller's company, then
  re-validates the whole body with a hand-written validator in `utils/`, built on
  `parseIsoDate`. The developer chose this over `zod`, so no package is added. It
  plays the role of the "schema" the template asks for.
- **The server trusts nothing from the suggestion:** the browser sends only what is
  in the form, and the server treats it as user input.
- **Rendering:** values appear only as React text and input values, never through
  `dangerouslySetInnerHTML`.

### R2 files

No change to how files are stored or served. The file route uses `extractedType`
for the download name, which is now user input. It already removes every character
except letters, digits, `_`, `-` and spaces, so nothing can break the header, and
it falls back to "certificate" when the value is empty.

### Roles

Company users confirm their own documents, checked by the company lookup above. No
new admin route. The admin queue only shows names users have confirmed.

### Rate limits

Gemini costs quota on each upload. This feature adds no Gemini calls, and reloading
never calls Gemini again. Uploads still have no rate limit of their own, only
Gemini's daily quota. That is an existing gap, and it stays out of scope.

### Personal data

The certificate type and expiry date, and any personal details that are inside a
PDF. No new data is collected, and the validator's errors do not repeat the value
sent. Tests and fixtures use synthetic data only.

## Test plan

Vitest against the test database, in `test/api-test/ai-boundary.db.test.ts`:

- Change the `it.fails` test "saves no AI values before the user confirms them" to
  `it`, and remove its KNOWN GAP comment (AC 1).
- Extend "keeps the upload and saves no AI values when Gemini fails" to check all
  three fields (AC 2). Add a case for an unusable Gemini answer (AC 2).
- Keep "creates no pending request by itself" (AC 3).
- Update "links the document once the user confirms" to the new body and check that
  all three values are stored (AC 4).

Vitest against the test database, in `test/api-test/documents.db.test.ts`:

- Move the `patchDocument` helper and existing tests to the new body.
- New tests for AC 4 to 11, 14 and 15.
- Cross-tenant tests for AC 12 and 13.

Unit tests, no Docker, in `test/util-test/confirm-payload.test.ts`:

- Each valid and invalid shape for the validator (AC 7 to 10).

Migration test, in `test/database-test/clear-unconfirmed-ai-values.db.test.ts`:

- Creates one undecided, one linked and one pending document in the test database,
  runs the SQL read from the migration file, and checks the rows (AC 23).

Browser test, in `test/e2e-test/confirm-upload.spec.ts`:

- Answers `POST /api/documents` in the browser, as the smoke test does for classify,
  so Gemini and R2 are never called. The document row is created directly in the
  test database.
- Covers the prefilled card, the empty cases, Save staying disabled, the reload, the
  row text and the HTML case (AC 16 to 22).

`/ui-test` then walks the same flows by hand on localhost, including the admin queue
showing the confirmed name.

## Out of scope

- A "Read again" button that calls Gemini a second time.
- Draft columns or tables for suggestions.
- Rate limits on upload.
- Renaming `extractedType`.
- Deleting a document.
- Unsaved uploads, planned as spec 002: creating no row until the user clicks Save,
  and removing an earlier unsaved file from R2 when another PDF is uploaded.
- Confirming a "not on my checklist" document for a company with no category. The
  pages already redirect those users to setup, so the route's existing behaviour
  stays as it is.

## Decisions

- A confirmed row shows its values as read-only text with an Edit button, and an
  unconfirmed row shows its form open. The developer wants to try this layout.
- The "Just uploaded" card stays visible after saving and shows "Saved", as it does
  today.
- A linked document with no stored type, from an earlier Gemini failure, is shown as
  "Unnamed document" until the user edits it.
- The validator ignores extra fields in the body instead of refusing them.
- An upload still creates an empty row in this spec. Uploading a second PDF replaces
  the card, as it does today, so the first document's suggestion is lost and its row
  is filled in by hand. The developer chose to change this later, in spec 002.

## Steps

### Step 1: Validate the confirm body

- Files: create `utils/confirmPayload.ts`, create
  `test/util-test/confirm-payload.test.ts`
- Tests: `confirm-payload.test.ts` covers missing fields (AC 7), bad types (AC 8),
  bad dates (AC 9) and past dates (AC 10). Nothing calls the validator yet, so the
  app behaves as before.
- Commit: `feat: add validator for the document confirm body`
- Done: yes

### Step 2: Build the confirm form

- Files: create `components/confirmForm.tsx` with the type, date, "No expiry date"
  and checklist fields, and Save disabled until they are complete
- Tests: none yet, because nothing shows the form. `npm run check` must pass. Step 8
  proves its behaviour in the browser (AC 17, 19).
- Commit: `feat: add the document confirm form`
- Done: yes

### Step 3: Confirm all three values together

The route and the screen change in one commit, because the old dropdown's request
would be refused by the new route.

- Files: change `app/api/documents/[id]/route.ts`, `components/uploadForm.tsx` and
  `app/(workspace)/documents/page.tsx`, delete `components/matchSelect.tsx`, change
  `test/api-test/documents.db.test.ts` and `test/api-test/ai-boundary.db.test.ts`
- Tests in `documents.db.test.ts`: move the `patchDocument` helper and existing tests
  to the new body, and add route tests for AC 4 to 11. The cross-tenant tests
  `gives company B a 404 on company A's document and changes nothing`,
  `creates no pending request when company B sends null` and
  `answers the same for another company's document and a missing one` prove AC 12
  and 13.
- Tests in `ai-boundary.db.test.ts`: update `links the document once the user confirms`
  to check all three values (AC 4).
- Commit: `feat: confirm type, date and checklist item together`

### Step 4: Keep a waiting request's name in step

- Files: change `lib/pendingRequirements.ts`, change
  `test/api-test/documents.db.test.ts`
- Tests: a new type renames a request in `PENDING_REVIEW` (AC 14), and leaves
  `APPROVED` and `REJECTED` requests unchanged (AC 15).
- Commit: `feat: update a waiting request when its type is edited`

### Step 5: Show confirmed and unconfirmed rows differently

- Files: change `app/(workspace)/documents/page.tsx` and `components/confirmForm.tsx`
- Tests: none new in Vitest, because this is page layout. Step 8 proves the row text
  (AC 20, 21). `npm run check` must pass.
- Commit: `feat: show read-only confirmed rows with an edit button`

### Step 6: Stop saving model output on upload

This comes after the form on purpose, so that every document can already be filled
in by hand when upload stops saving the values.

- Files: change `app/api/documents/route.ts`, change
  `test/api-test/ai-boundary.db.test.ts`
- Tests: change the `it.fails` test `saves no AI values before the user confirms them`
  to `it` and remove its KNOWN GAP comment (AC 1). Extend
  `keeps the upload and saves no AI values when Gemini fails` to check all three
  fields, and add a test for an unusable Gemini answer (AC 2). Keep
  `creates no pending request by itself` (AC 3).
- Commit: `fix: save no model output before the user confirms it`

### Step 7: Clear old unconfirmed AI values

Uses `/safe-migration`. The schema does not change, so the developer creates an empty
migration with `--create-only`, and the SQL from this spec goes in it for review
before it is applied.

- Files: create `prisma/migrations/<timestamp>_clear_unconfirmed_ai_values/migration.sql`,
  create `test/database-test/clear-unconfirmed-ai-values.db.test.ts`
- Tests: `clear-unconfirmed-ai-values.db.test.ts` creates one undecided, one linked
  and one pending document, runs the SQL read from the migration file, and checks the
  rows (AC 23).
- Commit: `feat: clear unconfirmed AI values from existing documents`

### Step 8: Prove the flows in the browser

- Files: create `test/e2e-test/confirm-upload.spec.ts`
- Tests: `confirm-upload.spec.ts` answers `POST /api/documents` in the browser and
  creates the document row directly in the test database. It covers the prefilled
  card and date (AC 16), no date (AC 17), nothing returned (AC 18), Save disabled
  (AC 19), the reload (AC 20), the row text (AC 21) and HTML shown as text (AC 22).
- Commit: `test: cover the confirm flow in the browser`
