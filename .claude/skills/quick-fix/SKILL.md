---
name: quick-fix
description: Make a small fix without a spec, on its own branch, with a test and a PR. Use when the developer reports a small bug or wants a small change, or runs /quick-fix. Not for anything touching the schema or auth.
argument-hint: <what is wrong>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Make a quick fix

The problem: $ARGUMENTS

If no problem was given, ask for one and wait.

The developer runs every git command that changes something. Give the commands
in the developer's shell, then check the result with read-only git commands.

## When to stop and use /start

At any point, stop if the fix would:

- touch the database schema or a migration
- touch auth, or who can see or change a record
- change more than 3 files of product code (test files do not count)

Explain what you found and tell the developer to use /start. Do not continue
with a smaller version of the fix unless the developer asks for it.

## Steps

1. Read CLAUDE.md and the workflow file it links to. If either is missing, stop
   and tell the developer what you could not find.
2. Find the root cause. Only read. Never open secret files.
3. Explain the root cause and the fix in simple words, with what changes and what
   happens without it. **Stop and wait for "go".**
4. Give the commands to create the branch, named as the workflow file says.
   **Stop and wait**, then check the branch.
5. Write a failing test where it makes sense, then run it. Confirm that it fails
   for the expected reason. If a test does not make sense here, say so and say
   why.
6. Write the fix.
7. Run the checks listed in CLAUDE.md that cover this change. Report what you ran
   and the result. If one fails, explain the root cause before fixing it. Never
   weaken or delete a test, or skip a check, to get a pass.
8. If the fix changes the UI, check it in the browser:
   - State the expected result in one sentence.
   - Follow the "Rules for the browser" in the ui-test skill.
   - Walk that flow, and check the console and failed network requests.
9. Show the evidence: each command with its result, and what you saw in the
   browser.
10. Give the commit commands with a conventional commit message. **Stop.** The
    developer commits. The next stage is /pr, and only the developer starts it.

## Limits

- Never push, open a PR, or merge. Those belong to /pr and the developer.
- Fix only this problem. Mention anything else you notice, and leave it alone.
