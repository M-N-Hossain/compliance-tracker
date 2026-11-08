# How we build features

This file describes the process. It enforces nothing: permission rules, hooks,
CI and GitHub settings do that. The commands to run are in the "Commands"
section of CLAUDE.md, so they are not repeated here.

## Words used here

- **Feature:** the whole goal, such as "login and sign-up handle failures well".
  It has no file. It is made of one or more slices.
- **Slice:** one thin piece of a feature that works from end to end once merged.
  It has one spec (`Type: slice`) and one PR.
- **Design:** a spec for how a screen looks, decided before any code
  (`Type: design`). It has no steps, tests or PR.
- **Step:** one commit inside a slice. `/breakdown` writes the steps and `/build`
  does them one at a time.
- **Issue:** a GitHub issue for work that is not part of the running spec, such as
  a deferred finding. Later it becomes a new spec or a `/quick-fix`.

## Which path to use

- **Design path:** decides what a screen looks like, before any code is built.
- **Feature path:** builds one slice. A slice is a thin piece of a feature that
  works from end to end once merged: its route, its screen and its tests. A
  bigger feature is several slices, each with its own spec.
- **Quick-fix path:** small changes only. If a quick fix turns out to touch the
  schema, auth, or more than a few files, stop and use `/start`.

A spec names what it needs first in its `Depends on:` line, such as the design
spec a slice builds.

## Which stages a slice needs

Not every slice needs every stage. Pick by what the slice touches:

| The slice                                                            | What it needs                                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Changes a screen (a page or a component)                             | Every stage, including `/ui-test`.                                                            |
| No screen change (API, logic, data)                                  | Every stage except `/ui-test`. Write "no screen change" in the spec's limits line.            |
| Touches auth, the schema or a migration, the AI boundary or R2 files | Never `/quick-fix`, and the security tests always run. `/ui-test` follows the two rows above. |
| Small and safe: no auth, no schema, a few files                      | `/quick-fix`, with no spec.                                                                   |
| Only docs, workflow text or config                                   | A `chore/` branch and a PR, with no spec.                                                     |

Only `/ui-test` can be skipped, and only when no screen file changed and no
criterion waits for the browser. `/test`, `/review-changes` and `/pr` always run
for a slice. A skipped stage is named in the spec's "Evidence and review" limits
line, with the reason, so nobody has to guess whether it was forgotten.

## Design path

```text
/start (design) -> prototype on branch proto/NNN-slug -> developer picks a version -> approved
```

1. **`/start <idea>`:** for a new or changed screen with no approved design,
   writes `docs/specs/NNN-design-slug.md` from `_template-design.md`.
2. **Prototype:** the `prototype` skill builds the versions on branch
   `proto/NNN-slug`. The prototype code is throwaway and is never merged.
3. **Decision:** the developer picks a version. The spec records the versions
   tried and the decision, its status becomes approved, and it is committed on
   the prototype branch.
4. **Reaching `main`:** the first slice that builds the design brings the design
   spec onto its own branch, so it is merged with that slice's PR.

A design spec has no steps, tests, review or PR of its own.

## Feature path

```text
/start -> /breakdown -> /build -> /test -> /ui-test -> /review-changes -> /pr -> /record
```

1. **`/start <idea>`:** asks clarifying questions, then writes
   `docs/specs/NNN-slug.md` from `_template.md` with status draft. Stops so the
   developer can review the draft.
2. **`/breakdown NNN`:** adds "## Steps" to the approved spec. Steps are small
   and ordered, each is one commit, each leaves the app working, and each lists
   its files and tests. A slice has at most 5 steps: more means two slices.
   Stops when the steps are written.
3. **`/build NNN`:** works on branch `feat/NNN-slug`. For each step: failing
   test first where it makes sense, implement, run checks, explain, commit.
   Stops after every step.
4. **`/test NNN`:** runs every automated check in CLAUDE.md, then goes through
   the acceptance criteria one by one with evidence. The results go in the
   evidence file, and the spec gets a short summary and a link.
5. **`/ui-test NNN`:** only for a slice that changes the screen. Walks the flows
   in the browser on localhost, including error and empty states, and checks
   them against the design spec's decision. A failed criterion goes back to
   `/build`, and other findings follow the findings rule below.
6. **`/review-changes NNN`:** saves the branch diff to a file. The review-code
   subagent checks it against the spec and CLAUDE.md. The built-in
   `/code-review` (the bug review) and `/security-review` also run. All findings
   are advice: CI and the developer are the gate. The developer decides each
   finding, and the findings and decisions are saved in the evidence file. A slice
   gets at most two rounds, see "Findings during a spec".
7. **`/pr` (only the developer starts it):** writes the PR description from the
   spec, pushes the branch and opens the PR (both ask first), waits for CI, and
   sets the spec status to submitted. The developer reviews and merges.
8. **`/record NNN` (only the developer starts it):** after the merge, writes the
   feature record into the brain repo. It waits for the merge because review
   can still change things. The developer approves the draft and commits it in
   the brain.

The spec and its evidence file are the memory between sessions.

## Statuses

The spec's status line says where the slice is, so the file answers "what is
next" without asking anyone. Each stage sets its own status:

| Status    | Set by                                            | Meaning                        |
| --------- | ------------------------------------------------- | ------------------------------ |
| draft     | `/start`                                          | being written and reviewed     |
| approved  | `/breakdown`                                      | approved, with its steps       |
| building  | `/build`, in each step's commit                   | steps are being built or fixed |
| tested    | `/test`, when no criterion fails or is unproven   | automated checks pass          |
| reviewed  | `/review-changes`, when no finding is open or fix | every finding is decided       |
| submitted | `/pr`                                             | the PR is open                 |

If code changes after `tested` or `reviewed`, `/build` sets the status back to
`building`, and the later stages run again. Nothing in the repo records the
merge, because no skill edits a spec after it. To see whether a PR is merged, ask
`gh`. A design spec only uses draft and approved.

`/next NNN` reads the status, the steps, the evidence file and the PR, and says
which stage comes next. It only reads and never starts the stage.

## Where evidence lives

A spec holds the plan: problem, criteria, security checklist, steps. The proof
goes in a second file, `docs/evidence/NNN-slug.md`, with the same name as the
spec and made from `docs/evidence/_template.md`. It has two parts: "Evidence"
(checks, one result per criterion, notes on what is not proven) and "Review"
(each round's findings and their decisions).

The spec ends with a short "Evidence and review" section: the result in a few
lines, the limits that matter, the finding counts and a link to the evidence
file. `/test`, `/ui-test` and `/review-changes` keep it up to date. This keeps
the spec short, so a new session can read the plan first and open the proof only
when it needs it.

## Findings during a spec

A running spec stays as it was approved. A finding is anything new that building,
testing, reviewing or trying the app turns up. Each one goes one of two ways:

- **Fix now:** it breaks the app, loses or corrupts data, opens a security hole,
  or makes one of the spec's own acceptance criteria fail. It goes back to
  `/build` in this spec, as a step that names the finding.
- **Issue:** everything else, such as polish, a UI idea, an edge case or a
  cleanup. It becomes a GitHub issue of one or two lines that links to the spec.
  Later, an issue becomes a new spec or a `/quick-fix`.

Claude recommends one of the two for each finding, and the developer decides.
Claude then opens the issues with `gh`, which asks the developer first. Related
small findings can share one issue, such as one test cleanup issue.

**Review rounds.** A slice gets at most two review rounds. Round 1 looks at the
whole branch. Round 2 looks only at what changed since round 1, which is the fixes,
and never repeats an earlier finding. Blockers, majors and minors are decided one
by one. Nits are listed and count as declined unless the developer names one. A
third round runs only if the developer asks for it.

## Quick-fix path

```text
/quick-fix -> branch fix/slug -> fix -> test -> /pr
```

There is no spec and no feature record.

## How much to test

Test what can hurt users or their data, once, at the cheapest level.

- **One test per acceptance criterion,** at the cheapest level that proves it:
  a unit test first, then an API or database test, and a browser test only for
  what only a browser can show.
- **Always tested:** company ownership (the cross-tenant test), login checks,
  the AI boundary, data migrations, and anything that can lose or corrupt data.
- **Skipped or kept light:**
  - layout and wording, which `/ui-test` checks by eye
  - a second test of a check already proven at a lower level
  - both sides of a limit, unless it is a security limit
- **At most about 10 acceptance criteria per spec.** More than that means the
  spec should be split.

## Definition of done

A feature is done only when all of these are true:

1. Every acceptance criterion has evidence in the evidence file: a test name or
   command output.
2. Every automated check in CLAUDE.md passes.
3. Any UI change has been tested in the browser.
4. Every review finding in the evidence file has been fixed, sent to an issue,
   or declined with a reason.
5. CI is green on the PR.
6. The developer has merged the PR.
7. The feature record has been written.

A quick fix needs items 2, 3, 5 and 6, plus evidence that the fix works.

Never say "done" without evidence.

## Git rules

- **Branches:** `feat/NNN-slug` for slices, `fix/slug` for fixes, `chore/slug`
  for maintenance, and `proto/NNN-slug` for prototypes, which are never merged.
- **Base:** run `git fetch origin` first, then start new branches from
  `origin/main` and compare against it. A local `main` only moves on a pull, so
  it can be behind and add merged work to a diff.
- **Commits:** conventional commits, such as `feat: add expiry reminders`. One
  commit per step.
- **Messages and PR descriptions:** they only explain what the change is about.
  No `Co-Authored-By` line and no "Generated with" line, or any other AI
  attribution.
- **Who runs git:** Claude creates branches and commits, and reports each
  commit's hash and title. It commits only after the step's checks pass, and adds
  files by name, never with `git add -A` or `git add .`. It never amends,
  rebases or resets a commit. Pushing asks the developer first.
- **Merging:** every change reaches `main` through a PR. Only the developer
  merges.

## Sessions

One spec per session. To continue a spec later, start a new session and read
it.
