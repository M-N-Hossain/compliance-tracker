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

Added after the browser test found a real blank PDF returning the type `NONE`:

24. Given Gemini returns `NONE` in any capitals, or null, as the type, when a PDF is
    uploaded, then the response is 201 with `extracted` null and the file is stored. A
    real type that only contains that word is kept.

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
- The "Just uploaded" card stays visible after its document is confirmed, in the card or
  the row, and shows "Saved. You can edit it in the list below." instead of a form. Changed
  in Step 10.
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
- Done: yes

### Step 4: Keep a waiting request's name in step

- Files: change `lib/pendingRequirements.ts`, change
  `test/api-test/documents.db.test.ts`
- Tests: a new type renames a request in `PENDING_REVIEW` (AC 14), and leaves
  `APPROVED` and `REJECTED` requests unchanged (AC 15).
- Commit: `feat: update a waiting request when its type is edited`
- Done: yes

### Step 5: Show confirmed and unconfirmed rows differently

- Files: change `app/(workspace)/documents/page.tsx` and `components/confirmForm.tsx`
- Tests: none new in Vitest, because this is page layout. Step 8 proves the row text
  (AC 20, 21). `npm run check` must pass.
- Commit: `feat: show read-only confirmed rows with an edit button`
- Done: yes

### Step 5b: Widen the edit form and rename its field

Added after the developer tried Step 5. The form opens as a full-width panel under
the row, and the "Checklist item" field is now labelled "Covers". Code and database
names stay as they are.

- Files: change `components/confirmForm.tsx`, `app/(workspace)/documents/page.tsx`
  and `utils/confirmPayload.ts`
- Tests: none new in Vitest, because this is layout and wording. Step 8 uses the new
  label. `npm run check` and `npm test` must pass.
- Commit: `feat: open the document form as a wide panel labelled Covers`
- Done: yes

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
- Done: yes

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
- Done: yes

### Step 8: Prove the flows in the browser

- Files: create `test/e2e-test/confirm-upload.spec.ts`
- Tests: `confirm-upload.spec.ts` answers `POST /api/documents` in the browser and
  creates the document row directly in the test database. It covers the prefilled
  card and date (AC 16), no date (AC 17), nothing returned (AC 18), Save disabled
  (AC 19), the reload (AC 20), the row text (AC 21) and HTML shown as text (AC 22). It
  also covers the Edit and Cancel buttons on a confirmed row, which have no acceptance
  criterion of their own.
- Commit: `test: cover the confirm flow in the browser`
- Done: yes

### Step 9: Treat a "nothing read" answer as nothing

Added after the browser test, with the developer's agreement. Gemini may now return
null for the type, and `NONE` counts as nothing read. Automated tests use scripted
answers, so only a real upload can show what Gemini now does with a blank PDF.

- Files: change `lib/extractCertificate.ts` and `test/api-test/ai-boundary.db.test.ts`
- Tests: `treats the type %j as nothing read` for `NONE`, `none`, `None` and null, and
  `keeps a real type that only contains the word NONE` (AC 24)
- Commit: `fix: treat a NONE certificate type as nothing read`
- Done: yes

### Step 10: Stop the upload card overwriting confirmed values

Added because the developer marked review finding 1 as fix.

- Files: change `components/uploadForm.tsx`, `app/(workspace)/documents/page.tsx` and
  `test/e2e-test/confirm-upload.spec.ts`
- Tests: `cannot overwrite values confirmed in the row` and
  `stops being a form once it has saved`
- Commit: `fix: stop the upload card overwriting confirmed values`
- Done: yes

### Step 11: Refuse values the database cannot store

Added because the developer marked review finding 5 as fix.

- Files: change `utils/confirmPayload.ts` and `test/util-test/confirm-payload.test.ts`
- Tests: a 400 for a checklist id over 32 bits, a NUL character in the type and the year
  0000 (AC 8, 9 and 11)
- Commit: `fix: refuse confirm values the database cannot store`
- Done: yes

## Evidence

Date: 2026-11-02. Commit: 1244bd4, after Steps 10 and 11.

| Check                                            | Result               |
| ------------------------------------------------ | -------------------- |
| `npm run lint`                                   | passed, exit 0       |
| `npm run check`                                  | passed, exit 0       |
| `npm run test:unit`                              | 97 passed, 9 files   |
| `npm test`                                       | 146 passed, 13 files |
| `npm run test:e2e`                               | 14 passed            |
| `node test/hook-test/block-destructive.test.mjs` | 64 of 64 passed      |

| Criterion | Result | Evidence                                                                                                                                                                                                                                                             |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | pass   | `saves no AI values before the user confirms them`, `returns the AI's match as a suggestion but does not save it`                                                                                                                                                    |
| 2         | pass   | `keeps the upload and saves no AI values when Gemini fails`, `keeps the upload and saves no AI values when Gemini's answer is unusable`                                                                                                                              |
| 3         | pass   | `creates no pending request by itself`                                                                                                                                                                                                                               |
| 4         | pass   | `stores the confirmed type, date and checklist item`, including trimming                                                                                                                                                                                             |
| 5         | pass   | `stores no expiry date when the user sends null`                                                                                                                                                                                                                     |
| 6         | pass   | `names the pending request with the type the user sent`                                                                                                                                                                                                              |
| 7         | pass   | `refuses a body with only requirementTemplateId...`, `no type`, `no date`, `no checklist item`, each comparing the whole row                                                                                                                                         |
| 8         | pass   | `refuses a type that is not text`, `a blank type`, `a type over 200 characters`. Validator test `refuses a NUL character`, and the route answers 400 whenever the validator refuses (`route.ts:49`)                                                                  |
| 9         | pass   | `refuses an impossible date`, `refuses a date in the wrong format`. Validator test `refuses the year 0000`, and the route answers 400 whenever the validator refuses (`route.ts:49`)                                                                                 |
| 10        | pass   | `stores an expiry date in the past`                                                                                                                                                                                                                                  |
| 11        | pass   | `refuses a template from outside the company's checklist`. Validator test `refuses an id over 32 bits`, and the route answers 400 whenever the validator refuses (`route.ts:49`)                                                                                     |
| 12        | pass   | `gives company B a 404 on company A's document and changes nothing`, `creates no pending request when company B sends null`                                                                                                                                          |
| 13        | pass   | `answers the same for another company's document and a missing one`                                                                                                                                                                                                  |
| 14        | pass   | `renames a request that is still waiting when the type is edited`                                                                                                                                                                                                    |
| 15        | pass   | `keeps the name of a request that is APPROVED...`, `...REJECTED...`                                                                                                                                                                                                  |
| 16        | pass   | `shows Gemini's suggestion in editable fields, with no date shift`, in the Pacific/Honolulu time zone. The upload response is scripted                                                                                                                               |
| 17        | pass   | `leaves the date empty and the box unticked when Gemini found no date`                                                                                                                                                                                               |
| 18        | pass   | `shows empty fields and a message when Gemini returned nothing` proves the fields and "This file could not be read." The rest of the message was seen in the browser before Step 9, which changed no screen code. The developer chose not to repeat the browser test |
| 19        | pass   | `keeps Save disabled until every question is answered`                                                                                                                                                                                                               |
| 20        | pass   | `shows no AI value after a reload before confirming`. No Gemini call: the empty blocked-network log, and `extractCertificate` is only called from the upload route                                                                                                   |
| 21        | pass   | `no longer says the AI could not read the file`. The text is also absent from app, components, lib and utils                                                                                                                                                         |
| 22        | pass   | `shows HTML in a suggestion as plain text and runs nothing`. `dangerouslySetInnerHTML` is absent from app, components, lib and utils                                                                                                                                 |
| 23        | pass   | The 6 tests in `clear-unconfirmed-ai-values.db.test.ts`, which run the real migration file                                                                                                                                                                           |
| 24        | pass   | `treats the type "NONE"`, `"none"`, `" None "` and `null as nothing read`, `keeps a real type that only contains the word NONE`, using scripted Gemini answers                                                                                                       |

| Security test                                                       | Ran | Result |
| ------------------------------------------------------------------- | --- | ------ |
| `gives company B a 404 on company A's document and changes nothing` | yes | pass   |
| `creates no pending request when company B sends null`              | yes | pass   |
| `answers the same for another company's document and a missing one` | yes | pass   |
| `gives 401 when nobody is logged in and changes nothing`            | yes | pass   |
| `refuses a user with no company and changes nothing`                | yes | pass   |
| `does not repeat the sent value in the error`                       | yes | pass   |

Steps 10 and 11 fix review findings 1 and 5 and add no criterion. Step 10 is proven by
`cannot overwrite values confirmed in the row` and `stops being a form once it has saved`,
which ran in this run. Nobody has seen it in a real browser yet.

### Browser

This run was before Step 9, against the build of commit 522d118's product code. The
developer chose not to repeat it, so a real blank PDF has not been tried since Step 9.

Follow-ups for a new issue or spec, not this one:

- Spec 002: unsaved uploads, as listed under Out of scope.
- Try a real blank PDF after Step 9, and handle other filler types such as "Unknown" if
  they appear.
- Check the confirmed name in the admin panel, a real View PDF click and a true phone
  width, which were not run.
- Decide what a row should say for documents with an `APPROVED` request and no link.
- Remove the test data listed at the end of this section.

Date: 2026-11-01, on http://localhost:3000 with the development database. Screenshots
were skipped at the developer's request, so there is no screenshot folder.

| Criterion | Result | What was seen                                                                                                               |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| 16        | pass   | Real PDF through real Gemini and R2: type, 31 March 2027 and the matching item were filled in and marked as suggested by AI |
| 17        | pass   | Real PDF with no date: date empty, box unticked, Save disabled                                                              |
| 18        | pass   | Faked upload response: full message, empty fields, Save disabled                                                            |
| 19        | pass   | Save stayed disabled until type, covers and a date or the box were answered, and unticking disabled it again                |
| 20        | pass   | After a reload: "Not confirmed yet", empty fields, View PDF. The database held no type, date or link for the 3 real uploads |
| 21        | pass   | Rows with no type say "Unnamed document", and the old message did not appear                                                |
| 22        | pass   | `<img src=x onerror=...>` saved and shown as plain text, no image added, nothing ran                                        |

Also seen working: the full-width panel, Edit, Cancel throwing away a change, saving an
edit, "Not on my checklist" showing "Waiting for admin review" with the typed name in
the database, and the dashboard showing the new date and Covered.

Console errors: none. Failed requests: none. Request tracking started after the first
upload, so that one request was not recorded.

Not run:

- The confirmed name in the admin panel: the account is not an admin, and the test does
  not log in.
- A real View PDF click: it redirects to R2, and this test may only open the app URL.
- A true phone width: Chrome's window stopped at 502px wide. At that width the fields
  stacked with no sideways scroll.

Findings:

1. A real blank PDF came back from Gemini with the type `NONE`. The card showed it as
   "Suggested by AI" with "Not on my checklist" selected, not the "could not be read"
   message. Nothing is saved unless the user clicks Save, but saving it unchanged would
   send admins a request named `NONE`.
2. The upload card shows type and date side by side with Covers below, not fully
   stacked as proposed for Step 5b.
3. Documents 15 and 20 have an `APPROVED` request and no checklist link, so their rows
   show no status line and their form shows "Not on my checklist".

Test data left in the development database for this company: documents 31 (covers Fire
Safety on the dashboard), 32 (a `PENDING_REVIEW` request) and 33 (unconfirmed).

## Review

Date: 2026-11-01. Commit: 8b634f2.

| Review   | Result                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Spec     | ran, review-code subagent                                                                                          |
| Bug      | ran, from the developer's `/code-review` command, because the `/review` alias could not be started from this skill |
| Security | ran, no finding reached the reporting threshold                                                                    |

A clean result from any review does not prove the code is safe. These reviews read the code, and most 500 responses below are inferred, not run.

| #   | Severity | File and line                                                                                | Finding                                                                                                                                                                                                                     | Source    | Decision                                                                                                                   |
| --- | -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | high     | `components/uploadForm.tsx:184`                                                              | The upload card and the row are separate forms for one document. After a save in the row, the card still offers Save with the AI's values, and one click overwrites the confirmed values                                    | Bug, Spec | fix: breaks the spec's goal that confirmed values are what get saved                                                       |
| 2   | high     | `components/confirmForm.tsx:92`                                                              | Every save resends the checklist item from the form's state. In a tab loaded before an admin approved, fixing a typo sends null, clears the link and drops the item to Missing                                              | Bug       | declined: real, but outside this spec. Goes to a new issue, first in line. Needs a design for out-of-date tabs             |
| 3   | medium   | `app/api/documents/[id]/route.ts:82`                                                         | The document update and the request sync are separate writes, and a sync failure still returns 200, so a save can report success with no request or an old name                                                             | Bug, Spec | declined: real, but outside this spec. Goes to a new issue. The try/catch predates this branch                             |
| 4   | medium   | `components/confirmForm.tsx:62`                                                              | A partly typed year such as `0027-03-31` passes the form and the validator, and is stored as a real date, so the dashboard shows Expired                                                                                    | Bug       | declined: real, but outside this spec. Goes to a new issue. Needs a date-range rule the spec does not have                 |
| 5   | medium   | `utils/confirmPayload.ts:51`                                                                 | A checklist id over 32 bits, a NUL character in the type, or the year 0000 passes the validator and likely gives a 500, not the 400 of AC 8, 9 and 11                                                                       | Bug, Spec | fix: AC 8, 9 and 11 require a 400                                                                                          |
| 6   | medium   | `lib/pendingRequirements.ts:32`                                                              | A user can rename a waiting request to match another company's, and an admin's bulk approval then links their document unseen. Security review rated exploitation low, because a company can already link its own documents | Bug       | declined: real, but outside this spec. Goes to a new issue. Low risk, because a company can already link its own documents |
| 7   | medium   | `app/(workspace)/documents/page.tsx:134`                                                     | An older linked document with no date opens with "No expiry date" ticked, though nobody chose that, and its save confirms it                                                                                                | Bug, Spec | declined: real, but outside this spec. Goes to a new issue. Only affects older data                                        |
| 8   | medium   | `lib/extractCertificate.ts:94`                                                               | A null or `NONE` type discards a date and match Gemini did read. This is the behaviour AC 24 specifies                                                                                                                      | Bug       | declined: this is the behaviour AC 24 specifies                                                                            |
| 9   | medium   | `lib/extractCertificate.ts:99`                                                               | Only the word `NONE` is caught, so "Unknown" or "N/A" would still appear as AI suggestions. The new prompt and schema have never run against real Gemini                                                                    | Bug, Spec | declined: real, but outside this spec. Goes to a new issue. Already on the follow-up list                                  |
| 10  | low      | `lib/pendingRequirements.ts:30`                                                              | The rename checks status on an earlier read, so it could rename a request an admin decided a moment before                                                                                                                  | Bug       | declined: real, but outside this spec. Goes to a new issue. Very narrow timing, and it grants no access                    |
| 11  | low      | `prisma/migrations/20261101164303_clear_unconfirmed_ai_values/migration.sql:7`               | A request with a NULL `documentId` would not protect its document from being cleared. Checked in the development database: 6 requests, 0 with a NULL `documentId`, so nothing was wrongly cleared                           | Bug       | declined: 0 affected rows in the development database, and the migration is applied                                        |
| 12  | low      | `docs/specs/001-confirm-ai-values.md:240`                                                    | The test plan's admin queue check in `/ui-test` was not run                                                                                                                                                                 | Spec      | declined: real, but outside this spec. Goes to a new issue                                                                 |
| 13  | low      | `test/api-test/documents.db.test.ts:272`                                                     | The 401 and no-company tests check only the checklist item, though the route now writes three fields                                                                                                                        | Spec      | declined: real, but outside this spec. Goes to a new issue, as one test cleanup                                            |
| 14  | low      | `test/util-test/confirm-payload.test.ts:69`                                                  | The extra fields test would still pass if the validator refused the body                                                                                                                                                    | Spec      | declined: real, but outside this spec. Goes to a new issue, as one test cleanup                                            |
| 15  | low      | `test/e2e-test/confirm-upload.spec.ts:168`                                                   | The AC 18 test does not check "Fill in the values by hand"                                                                                                                                                                  | Spec      | declined: real, but outside this spec. Goes to a new issue, as one test cleanup                                            |
| 16  | nit      | `test/api-test/documents.db.test.ts:218`, `:222`, `test/e2e-test/confirm-upload.spec.ts:232` | Weak or missing test checks: a request count that cannot fail, ownership before body reading, and the box after a reload                                                                                                    | Spec      | declined: real, but outside this spec. Goes to a new issue, as one test cleanup                                            |
| 17  | nit      | `utils/match.ts:1`, `lib/pendingRequirements.ts:38`, `components/confirmForm.tsx:8`          | Stale comments, and the 200 limit declared in two files                                                                                                                                                                     | Spec, Bug | declined: real, but outside this spec. Goes to a new issue, as one cleanup                                                 |

### Second review

Date: 2026-11-02. Commit: 522fbcd, after Steps 10 and 11.

| Review   | Result                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Spec     | ran, review-code subagent                                                                                          |
| Bug      | ran, from the developer's `/code-review` command, because the `/review` alias could not be started from this skill |
| Security | ran, no finding reached the reporting threshold                                                                    |

Spec review: Steps 10 and 11 fix findings 1 and 5. The bug review repeated findings 3 and 17, which are not listed again. None of the findings below fails an acceptance criterion. The 500 results are inferred from the code, not run.

| #   | Severity | File and line                                                            | Finding                                                                                                                                                                      | Source    | Decision                                                                                        |
| --- | -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| 18  | medium   | `components/uploadForm.tsx:29`                                           | A Gemini type over 200 characters fills the card with Save enabled, and every save gets a 400, so the user must cut it by hand                                               | Bug       | declined: real, but outside this spec. Goes to a new issue                                      |
| 19  | medium   | `components/confirmForm.tsx:184`                                         | Ticking "No expiry date" wipes the date, so unticking it does not bring the suggested or saved date back                                                                     | Bug       | declined: real, but outside this spec. Goes to a new issue                                      |
| 20  | low      | `components/uploadForm.tsx:185`                                          | The card and the row are still two forms for one undecided document. Unsaved card edits vanish when the row saves, and a second tab or a failed refresh still shows the card | Spec, Bug | declined: real, but outside this spec. Goes with finding 2 in the out-of-date tabs issue        |
| 21  | low      | `app/api/documents/[id]/route.ts:26`                                     | A document id in the URL over 32 bits likely gives a 500, not a 404. The check is unchanged from main                                                                        | Spec, Bug | declined: older than this branch. Goes to a new issue, as the same kind of problem as finding 5 |
| 22  | low      | `lib/pendingRequirements.ts:29`                                          | After a request is REJECTED, a corrected type never reaches an admin again. AC 15 asks for the name to stay, and main behaves the same                                       | Bug       | declined: this is what AC 15 asks for, and main behaves the same. Goes to a new issue           |
| 23  | low      | `test/util-test/confirm-payload.test.ts:114`, `:131`, `:151`             | Step 11's tests check the validator, not a 400 from the route with the document unchanged                                                                                    | Spec      | declined: real, but outside this spec. Goes into the test cleanup issue                         |
| 24  | nit      | `test/util-test/confirm-payload.test.ts:150`                             | The lower 32-bit limit has no test                                                                                                                                           | Spec      | declined: real, but outside this spec. Goes into the test cleanup issue                         |
| 25  | nit      | `test/e2e-test/confirm-upload.spec.ts:190`                               | `cannot overwrite values confirmed in the row` never checks the stored checklist item                                                                                        | Spec      | declined: real, but outside this spec. Goes into the test cleanup issue                         |
| 26  | nit      | `lib/pendingRequirements.ts:30`, `app/(workspace)/documents/page.tsx:37` | An unchanged name is still written, and the decided or undecided split is worked out four times                                                                              | Bug       | declined: real, but outside this spec. Goes into the code cleanup issue                         |
| 27  | nit      | `lib/extractCertificate.ts:50`                                           | Two prompt sentences are joined with no space between them                                                                                                                   | Bug       | declined: real, but outside this spec. Goes into the code cleanup issue                         |
| 28  | nit      | `docs/specs/001-confirm-ai-values.md:399`                                | The Step 10 Tests line breaks a code span over two lines                                                                                                                     | Spec      | fixed in this spec commit, no code change                                                       |
