# NNN: Short title of the slice

<!--
How to use this template:
- Copy this file to docs/specs/NNN-slug.md, using the next free number.
- A slice is a thin piece of a feature that works from end to end once merged.
- Keep to about 10 acceptance criteria. More means two slices.
- Answer every line of the security checklist. If one does not apply, write
  "Not applicable, because..." with the reason.
- Do not add a Steps section. /breakdown adds it after the spec is approved.
- Do not fill in "Evidence and review". /test, /ui-test and /review-changes keep
  it up to date, and the full tables go in docs/evidence/NNN-slug.md.
- Delete this comment and the hints below when you fill it in.
-->

**Status:** draft

**Type:** slice

**Depends on:** none, or the specs that must be merged first, such as 003 (design)

## Problem

Why are we building this? Who has the problem today?

## User stories

- As a (role), I want (action), so that (result).

## Acceptance criteria

Each one must be testable, so /test can match it to a test name or command
output.

1. Given (starting state), when (action), then (result anyone can check).

## Data changes

What changes in the database? Does any change risk existing data (data loss,
defaults, renames)? If nothing changes, delete this section.

## Security checklist

- **Auth and ownership:** which route handlers and server actions change, and
  how each checks login and company ownership itself, not only in proxy.ts.
- **Cross-tenant test:** the name of the test showing that company B gets a 404
  on company A's record. Mandatory unless this touches no company data.
- **AI boundary:** does this save or show model output? It is never saved before
  the user confirms it, the confirm endpoint checks ownership and re-validates
  the payload, and it is never rendered as HTML.
- **R2 files:** does this store or serve files? The bucket stays private,
  presigned URLs are short-lived, keys are prefixed by company and checked on
  download, and size and type limits apply.
- **Roles:** which roles can do this, and how that is checked.
- **Rate limits:** does any call here cost money, such as Gemini, and what limits
  it.
- **Personal data:** what personal data this touches. Tests and fixtures use
  synthetic data only.

## Out of scope

What are we deliberately not doing in this slice?

## Evidence and review

Not run yet. Full tables and findings: docs/evidence/NNN-slug.md.
