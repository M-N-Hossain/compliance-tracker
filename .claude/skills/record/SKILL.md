---
name: record
description: Write the feature record into the brain repo after a feature's PR is merged. Only the developer starts this, with /record.
argument-hint: <spec-number>
# Only the developer can start this skill, because it writes outside this repo.
disable-model-invocation: true
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Record a merged feature

The spec number: $ARGUMENTS

If no number was given, ask for one and wait.

The record describes what was merged, because review can still change things.
Nothing is saved until the developer approves the draft. The developer commits in
the brain.

## Steps

1. Find the brain's location in the developer's user-level CLAUDE.md. If it is not
   there, stop and ask. Find the repo name from the git remote. Records go in
   `<brain>/projects/<repo-name>/features/NNN-slug.md`.
2. Read the brain's own CLAUDE.md and README, and follow their rules. Expect a
   permission prompt for each. Never read anything else in the brain outside
   `projects/<repo-name>/`.
3. Check with `gh` that the feature's PR is merged. If it is not, say so and
   **stop**. If `gh` is not available, ask the developer for the PR link and
   whether it is merged.
4. Read the merged sources, not the local branch:
   - the spec as it is on the remote main branch, including its "## Steps" and
     its short "Evidence and review" section
   - the evidence file as it is on the remote main branch,
     `docs/evidence/NNN-slug.md`, with its "## Evidence" and "## Review" parts
     (older specs may hold these parts in the spec itself)
   - the PR description
   - any decision records the spec or PR names
5. If a record for this feature already exists, read it and update it in place.
6. Ask the developer what they learned and which problems they hit. Offer problems
   the sources show, but never invent a lesson. **Stop and wait for the answer.**
7. Draft the record with these sections:
   - **What it is:** the feature from the user's view.
   - **How it works:** the key technical approach, in words.
   - **Decisions and why:** from the spec, the decision records, and any review
     findings that were declined.
   - **Steps we took:** condensed from "## Steps".
   - **How it was tested:** the evidence from the evidence file's "## Evidence".
   - **Problems and root causes:** from the developer's answers and the sources.
   - **What I learned:** the developer's own answer.
   - **Interview angle:** a short outline of situation, task, action and result.
   - **Links:** the PR URL, the spec path and the evidence file path.

   Write facts and decisions with their reasons. Never include code or secrets.
   Mark anything you are unsure of with CHECK.

8. Read the overview file in `<brain>/projects/<repo-name>/`, if there is one.
   List any line this feature makes out of date, with the suggested new wording.
9. Show the draft, the CHECK items, and the overview suggestions. **Stop and wait
   for approval.**
10. Save the approved record. Change the overview file only where the developer
    approved it.
11. Show the saved path and give the commit commands to run in the brain. **Stop.**

## Limits

- Never commit or push in the brain.
- Never open secret files.
- Do not change anything in this repo.
