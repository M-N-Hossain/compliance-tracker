---
name: build
description: Build a feature one planned step at a time, from a spec that has steps. Use when the developer wants to start or continue building a feature, or runs /build.
argument-hint: <spec-number>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Build a feature, one step at a time

The spec number: $ARGUMENTS

If no number was given, ask for one and wait.

Follow the "Who runs git" rule in the workflow file: you create the branch and
make the commits, and the developer pushes and merges.

## Before the first step

1. Read CLAUDE.md, the workflow file it links to, and the spec. If any of them is
   missing, stop and tell the developer what you could not find.
2. If the status is draft or submitted, or the spec has no "## Steps" section,
   stop and name the stage that comes first (/start or /breakdown). Any other
   status can build: approved and building continue the steps, and tested or
   reviewed means a finding sent the work back here.
3. Check the current branch. If it is not the feature branch named in the workflow
   file, create or switch to it. The spec may still be uncommitted, and it moves to
   the new branch with the switch. Check the branch again afterwards. If the spec
   depends on a design spec that is not on the main branch yet, bring that file
   over from its prototype branch with `git checkout proto/NNN-slug -- <path>`,
   and include it in the first commit.
4. Find the first step without a "Done: yes" line. If every step is done, say so
   and name the next stage (/test).

## For each step

1. Explain the step in simple words, with what changes and what happens without
   it. **Stop and wait for "go".** A "go" covers this step only.
2. Follow any project skill that covers this kind of change, such as a database
   change.
3. Write the failing tests the step lists, and no others, then run them. Confirm
   that they fail for the expected reason. If a test does not make sense here,
   such as for a config or styling change, say so and say why. If you think a
   test is missing, ask before adding it.
4. Write the code until the test passes, keeping to the files the step lists.
5. Run the checks listed in CLAUDE.md that cover this change. Report what you ran
   and the result.
6. Add a "Done: yes" line to the step in the spec, and set the spec's status to
   building. If the step fixes a review finding, change that finding's decision to
   "fixed in Step N" in the evidence file, `docs/evidence/NNN-slug.md`.
7. Explain what changed, so the developer could explain it back.
8. Commit the step's files with the step's commit message. The first commit also
   includes the spec. Report the commit's hash and title. **Stop.** The developer
   says when to continue.

## When something goes wrong

- **A test or check fails:** explain the root cause before fixing it. Never weaken
  or delete a test, or skip a check, to get a pass. If a fix is unclear, stop and
  ask.
- **The plan is wrong:** if a step needs files or work it does not list, or the
  spec no longer matches what is needed, stop before going further. Explain the
  mismatch and ask. Update the spec only after the developer agrees.
- **The work grew:** if a step is too big to be one commit, stop and suggest
  splitting it.

## Limits

- Never push, open a PR, or merge. Those belong to /pr and the developer.
- Do not build anything the spec lists as out of scope. Raise it instead.
- Never open secret files.
