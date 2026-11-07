# NNN evidence and review

<!--
How to use this template:
- Copy this file to docs/evidence/NNN-slug.md, with the same name as the spec.
- /test creates the Evidence part, /ui-test updates it, and /review-changes adds
  the Review part. Do not fill it in by hand.
- Keep the Evidence column to a test name or a short quote. Put any explanation
  in the notes.
- Delete this comment when you fill it in.
-->

Test results and review findings for the spec at docs/specs/NNN-slug.md. The spec
keeps the plan and a short result. This file keeps the proof.

## Evidence

Date: YYYY-MM-DD. Commit: short hash, plus "with uncommitted changes" if any.

| Check   | Result |
| ------- | ------ |
| command | result |

| Criterion | Result | Evidence  |
| --------- | ------ | --------- |
| 1         | pass   | test name |

Notes: one line for each result that is not a plain pass.

## Review

Date: YYYY-MM-DD. Commit: short hash.

| Review   | Result        |
| -------- | ------------- |
| Spec     | ran or reason |
| Bug      | ran or reason |
| Security | ran or reason |

| Severity | File and line | Finding       | Source | Decision |
| -------- | ------------- | ------------- | ------ | -------- |
| blocker  | path:line     | what is wrong | Spec   | open     |

For a later round, add a "### Round 2" heading with the same tables.
