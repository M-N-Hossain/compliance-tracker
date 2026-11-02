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
product code or tests. The only file it changes is the spec.

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

6. Do the same for the tests the spec's security section requires, and say whether
   each one ran and passed.
7. Add or replace a "## Evidence" section at the end of the spec:

   ```markdown
   ## Evidence

   Date: YYYY-MM-DD. Commit: short hash, plus "with uncommitted changes" if any.

   | Check   | Result |
   | ------- | ------ |
   | command | result |

   | Criterion | Result | Evidence           |
   | --------- | ------ | ------------------ |
   | 1         | pass   | test name or quote |
   ```

8. Commit the spec, so the next stage starts from a clean tree. Show the tables
   and the commit's hash. Say plainly whether anything failed, was not run, or is
   not proven. Say if a test service is still running, and how to stop it.
   Anything else you noticed that is not a criterion is a finding: list it with a
   recommendation, following the findings rule in the workflow file.
9. **Stop.** Never say "done" unless every criterion passes or waits for /ui-test.
   - Anything failed or not proven: the next stage is /build, once the developer
     decides.
   - Anything marked ui-test, or any UI change: the next stage is /ui-test.
   - Otherwise: the next stage is /review-changes.

## Limits

- Never weaken, skip, or delete a test to get a pass.
- Never open secret files.
