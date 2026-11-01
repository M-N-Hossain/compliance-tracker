---
name: start
description: Turn a new feature idea into a draft spec. Use when the developer wants to start a new feature or runs /start.
argument-hint: <idea>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Start a feature

The idea: $ARGUMENTS

This skill produces one draft spec and nothing else. Do not create a branch,
write product code, run a migration, or use git.

If no idea was given, ask for one and wait.

## Steps

1. Read CLAUDE.md and the workflow file it links to. They say where specs live
   and where the spec template is. If either is missing, stop and tell the
   developer what you could not find.
2. Read the spec template, and read the code this idea would touch. Only read.
   Never open secret files.
3. Ask the clarifying questions you need, covering:
   - what problem this solves, and for whom
   - what the result should be, including error and empty states
   - what is out of scope

   Do not ask what the code can already tell you.

4. **Stop and wait for the answers.** If they raise new questions, ask again.
5. Find the next free spec number: the highest existing number plus one, written
   with three digits, starting at 001. Choose a short lowercase slug for the
   name, so the path is `<specs folder>/NNN-slug.md`.
6. Copy the template to that path and fill in every section, following the
   template's own instructions:
   - Keep the status as draft.
   - Write acceptance criteria that a test or command output can prove.
   - Answer every security item. If one does not apply, say why.
   - Mark anything you assumed with CHECK, so the developer can correct it.
7. Show the path, and list every CHECK and open question.
8. **Stop.** The developer reviews the spec. The next stage is /breakdown, and it
   runs only after the developer approves the spec.
