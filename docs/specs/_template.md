# NNN: Short title of the feature

<!--
How to use this template:
- Copy this file to docs/specs/NNN-slug.md, using the next free number.
- Fill in every section. Never delete a security item: if one does not apply,
  write "Not applicable, because..." with the reason.
- Do not add a Steps section. /breakdown adds it after the spec is approved.
- Delete this comment and the hints below when you fill it in.
-->

**Status:** draft

## Problem

Why are we building this? Who has the problem today?

## User stories

- As a (role), I want (action), so that (result).

## Acceptance criteria

Each one must be testable, so /test can match it to a test name or command
output.

1. Given (starting state), when (action), then (result anyone can check).

## Data model and migrations

What changes in the database? Does any change risk existing data (data loss,
defaults, renames)? If nothing changes, say so.

## Security

### Auth and company ownership

Which route handlers and server actions does this add or change? How does each
one check auth and company ownership itself, not only in proxy.ts?

### Cross-tenant test

Mandatory. Name the test showing that company B gets a 404 on company A's record.

### AI boundary

Does this save or show model output? The confirm endpoint must check that the
record belongs to the caller's company and re-validate the edited payload with a
schema. Model output is never saved before the user confirms it, and never
rendered as HTML.

### R2 files

Does this store or serve files? The bucket stays private, presigned URLs are
short-lived, keys are prefixed by company and checked on download, and size and
type limits apply.

### Roles

Which roles can do this? How is that checked?

### Rate limits

Does any call here cost money, such as Gemini? What limits it?

### Personal data

What personal data does this touch? Tests and fixtures use synthetic data only.

## Test plan

List each test and its folder under test/, such as test/api-test/ or
test/e2e-test/. Say which acceptance criterion each one covers.

## Out of scope

What are we deliberately not doing in this feature?
