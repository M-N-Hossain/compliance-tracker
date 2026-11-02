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
2. Read the spec templates, and read the code this idea would touch. Only read.
   Never open secret files.
3. Decide the spec type, as the workflow file's "Which path to use" describes,
   and say why:
   - **design:** a new or changed screen with no approved design yet.
   - **slice:** one thin piece that works from end to end. If the idea needs
     several slices, or a design first, list them and write only the first.

   Then ask the clarifying questions you need, covering:
   - what problem this solves, and for whom
   - what the result should be, including error and empty states
   - what is out of scope

   Do not ask what the code can already tell you.

4. **Stop and wait for the answers.** If they raise new questions, ask again.
5. Find the next free spec number: the highest existing number plus one, written
   with three digits, starting at 001. Choose a short lowercase slug for the
   name, so the path is `<specs folder>/NNN-slug.md`, or `NNN-design-slug.md`
   for a design.
6. Copy the template for its type to that path and fill in every section,
   following the template's own instructions. Fill in `Depends on:`. For a
   design, leave "Versions tried" and "Decision" for after the prototype.
   - Keep the status as draft.
   - Write acceptance criteria that a test or command output can prove. Keep to
     the limit in the workflow file's "How much to test". If the idea needs more,
     suggest splitting it into two specs instead of writing them all.
   - Answer every security item. If one does not apply, say why.
   - Mark anything you assumed with CHECK, so the developer can correct it.
7. Show the path, and list every CHECK and open question.
8. **Stop.** The developer reviews the spec. The next stage runs only after the
   developer approves it:
   - **slice:** /breakdown.
   - **design:** the prototype, as the workflow file's "Design path" describes.
