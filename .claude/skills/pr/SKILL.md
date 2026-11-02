---
name: pr
description: Write the PR description from the evidence, push the branch, open the PR and wait for CI. Only the developer starts this, with /pr.
argument-hint: <spec-number, or nothing for a quick fix>
# Only the developer can start this skill, because it sends work off this machine.
disable-model-invocation: true
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Open a pull request

The spec number: $ARGUMENTS

With no number, this is a quick fix, and it has no spec.

This skill never merges. The developer reviews and merges.

## Check it is ready

1. Read CLAUDE.md and the workflow file it links to, plus the spec if there is
   one. If any of them is missing, stop and tell the developer what you could not
   find.
2. Check the branch and the working tree with read-only git commands. If this is
   the main branch, or anything is uncommitted, say so and **stop**.
3. Check the evidence:
   - **With a spec:** read its "## Evidence" section. If it is missing, or any
     result is FAIL, not run, not proven or ui-test, name each one and **stop**.
     The developer decides what happens next.
   - **Quick fix:** use the evidence from this conversation. If it is gone, run
     the checks listed in CLAUDE.md again.
4. With a spec, read its "## Review" section. If it is missing, if any review
   shows as not run, or if any finding's decision is open or fix, name each one
   and **stop**. The developer decides what happens next.

## Prepare

5. With a spec, change its status to submitted and commit the spec. This comes
   before the push, so that CI does not have to run again afterwards. Then check
   that the working tree is clean.
6. Draft a conventional title and this description:

   ```markdown
   ## Summary

   What this changes and why, in a few sentences.

   ## Acceptance criteria

   Each criterion, its result and its evidence. For a quick fix: what was wrong,
   the root cause, and the evidence that the fix works.

   ## Screenshots

   The screenshots to add, by file name, or "No UI change".

   ## How to test

   Steps the developer can follow to see it working.
   ```

   Use only facts from the spec, the evidence and the diff. Never include secrets
   or real personal data.

7. Show the title and description. **Stop and wait for approval.**

## Send

8. Push the branch to its remote. Expect a permission prompt, and never force.
9. Open the PR against the main branch with `gh`, passing the description from a
   temporary file outside the repository. Expect a permission prompt.
   - If `gh` is not available, give the developer the title, the description and
     the link to open the PR on GitHub. They then report the CI result.
10. Wait for CI with `gh pr checks --watch`, and report each check's result.
    - **CI failed:** explain the root cause from the logs, without fixing it. Fixes
      go back through /build or /quick-fix.
11. Show the PR link and list the screenshots the developer needs to add by hand.
12. **Stop.** The developer reviews and merges. After the merge, the next stage
    for a feature is /record.
