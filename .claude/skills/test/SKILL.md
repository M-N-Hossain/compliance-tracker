---
name: test
description: Run every automated check for a feature, then prove each acceptance criterion with evidence. Use when a feature's build steps are finished and before any claim that it is done, or when the developer runs /test.
argument-hint: <spec-number>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Test a feature against its spec

The spec number: $ARGUMENTS

This skill reports what it sees. It does not fix anything, and it does not change
product code or tests. The only files it changes are the evidence file and the
short "Evidence and review" section of the spec.

If no number was given, ask for one and wait.

## Steps

1. Read the "Commands" section of CLAUDE.md, the workflow file it links to, and
   the spec. If any of them is missing, stop and tell the developer what you could
   not find.
2. If the spec has steps without a "Done: yes" line, name them. **Stop and ask**
   whether to test anyway.
3. Start what the checks need, as CLAUDE.md describes, such as a test database.
   Use only the test services. Never touch a development database.
4. Run every automated check listed in CLAUDE.md. Record each command and its
   result. If one cannot run, record it as "not run" with the reason, and carry
   on with the others.
5. Give each acceptance criterion exactly one result:
   - **pass:** a test or command in this run proves it. Name the test or quote the
     output.
   - **FAIL:** the evidence shows it does not hold. Quote the output.
   - **ui-test:** only the browser can prove it, so it waits for /ui-test.
   - **not proven:** nothing in this run proves it. This does not count as a pass.

   Read each test you name, to confirm it checks what the criterion says. Evidence
   must come from this run, never from memory or an earlier run.

6. Do the same for the tests the spec's security checklist requires, and say whether
   each one ran and passed.
7. Write the results to the evidence file, `docs/evidence/NNN-slug.md`, with the
   same name as the spec. If it does not exist, copy
   `docs/evidence/_template.md` to that path. Add or replace its "## Evidence"
   part, and leave any "## Review" part as it is:

   ```markdown
   ## Evidence

   Date: YYYY-MM-DD. Commit: short hash, plus "with uncommitted changes" if any.

   | Check   | Result |
   | ------- | ------ |
   | command | result |

   | Criterion | Result | Evidence  |
   | --------- | ------ | --------- |
   | 1         | pass   | test name |

   Notes: one line for each result that is not a plain pass.
   ```

   Keep the Evidence column to the test name or a short quote. Put any
   explanation in the notes, not in the table.

8. Update the "## Evidence and review" section at the end of the spec. Add it if
   it is missing, using the spec template's wording. Keep it to a few lines:
   - the tests: date, commit, the check results and how many criteria pass
   - the limits: each result that is not a plain pass, any proof that is weaker
     than it looks, such as a staged failure or a fake error, and any stage the
     workflow lets this slice skip, such as /ui-test with "no screen change"
   - a link to the evidence file

   Leave the review line as it is. Do not copy the tables into the spec.
   If no criterion is FAIL or not proven, set the spec's status to tested. A
   criterion that waits for /ui-test does not block it, and the limits line says
   so. Otherwise leave the status as it is.

9. Commit the evidence file and the spec, so the next stage starts from a clean
   tree. Show the tables and the commit's hash. Say plainly whether anything
   failed, was not run, or is not proven. Say if a test service is still running,
   and how to stop it. Anything else you noticed that is not a criterion is a
   finding: list it with a recommendation, following the findings rule in the
   workflow file.
10. **Stop.** Never say "done" unless every criterion passes or waits for /ui-test.
    - Anything failed or not proven: the next stage is /build, once the developer
      decides.
    - Anything marked ui-test, or any UI change: the next stage is /ui-test.
    - Otherwise: the next stage is /review-changes.

## Limits

- Never weaken, skip, or delete a test to get a pass.
- Never open secret files.
