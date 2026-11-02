---
name: breakdown
description: Add small, ordered build steps to an approved feature spec. Use when the developer has reviewed a draft spec and wants to plan the work, or runs /breakdown.
argument-hint: <spec-number>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Break a spec into steps

The spec number: $ARGUMENTS

This skill adds a "## Steps" section to one spec and nothing else. Do not create
a branch, write product code, run a migration, or use git.

If no number was given, ask for one and wait.

## Steps

1. Read CLAUDE.md and the workflow file it links to, then find the spec with this
   number. If any of them is missing, stop and tell the developer what you could
   not find. If the spec already has a "## Steps" section, stop and ask whether
   to replace it.
2. If the spec contains any CHECK items, list them. **Stop and wait** until the
   developer has resolved them and the spec is updated.
3. If the status is draft, ask whether the developer approves the spec. **Stop and
   wait for the answer.** If they do not approve it, stop here. Only an explicit
   yes counts as approval.
4. Read the code the spec touches. Only read. Never open secret files.
5. Change the status to approved, then add a "## Steps" section at the end of the
   spec. Use this form for each step:

   ```markdown
   ### Step 1: Goal in a few words

   - Files: the files this step creates or changes
   - Tests: each test, its level (unit, API, database or browser) and the
     acceptance criterion it proves
   - Commit: a conventional commit message
   ```

   Every step must:
   - be small enough to be one commit that the developer can explain
   - leave the app working when it is finished
   - follow the steps before it, so nothing depends on later work

6. Check the plan against the spec:
   - Every acceptance criterion is covered by one test, at the level the workflow
     file's "How much to test" gives. Plan no second test of the same check.
   - Every test in the spec's test plan appears in a step.
   - The security section's tests appear in a step.

   Fix any gap by changing the steps. If the gap is in the spec itself, tell the
   developer instead of changing the spec's requirements.

7. Show the steps, followed by a list matching each acceptance criterion to its
   step.
8. **Stop.** The developer reviews the steps. The next stage is /build, and it
   runs only when the developer starts it.
