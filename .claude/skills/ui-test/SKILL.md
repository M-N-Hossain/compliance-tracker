---
name: ui-test
description: Test a feature's UI changes in the browser against its acceptance criteria, on the local app only. Use after /test for any UI change, or when the developer runs /ui-test.
argument-hint: <spec-number>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Test a feature in the browser

The spec number: $ARGUMENTS

This skill reports what it sees. It does not fix anything, and it does not change
product code or tests. The only file it changes is the spec.

If no number was given, ask for one and wait.

## Rules for the browser

- Only open the app URL listed in CLAUDE.md. Never open any other site.
- Never type a password. If a login page appears, stop and ask the developer to
  log in.
- Use only development data. Never upload real documents.
- Do not start the app. The developer runs it.

## Steps

1. Read CLAUDE.md, the workflow file it links to, and the spec. If any of them is
   missing, or CLAUDE.md lists no app URL, stop and tell the developer what you
   could not find.
2. Check that the browser tools are connected. If not, tell the developer how to
   connect them. **Stop and wait.**
3. Check that the app answers at the app URL. If not, ask the developer to start
   it. **Stop and wait.** If the app runs in Docker, check that it is not an old
   build: compare the app container's creation time from
   `docker ps --format "{{.Names}} {{.CreatedAt}}"` with the time of the latest
   commit that changed product code, from
   `git log -1 --format=%cI -- . ":!docs" ":!.claude" ":!test"`. If the container
   is older, ask the developer to run `docker compose up --build -d`. **Stop and
   wait.**
4. Open the app and check that the developer is logged in with their development
   test account. If a login page appears, **stop and wait.**
5. List the criteria that describe UI behaviour, including any marked ui-test in
   the spec's "## Evidence" section. If there are none, say so and stop.
6. For each of those criteria, walk the flow it describes:
   - Try the normal path, then the error states and empty states.
   - If the spec depends on a design spec, check that the screen matches its
     "Decision". A difference is a finding.
   - On each page, check the console for errors and look for failed network
     requests. Ask only for errors, since full logs are long.
   - Take screenshots only if the developer asks for them. Save them to
     `.screenshots/NNN/`, using the spec number. If they are saved elsewhere,
     move them there.
7. Give each criterion one result, with what you saw:
   - **pass:** you saw the expected result, and no related errors.
   - **FAIL:** you saw something else. Describe it, and name the screenshot if
     there is one.
   - **not run:** you could not reach this flow. Say why. This is not a pass.
8. Update the "## Evidence" section of the spec, creating it if needed. Replace
   each ui-test result with the new result, and add a short "Browser" note with
   the date, and the screenshot folder if there is one. Record console errors and
   failed requests, even if they look unrelated.
9. Commit the spec. Show the results and the commit's hash. Say plainly whether
   anything failed or was not run.
10. **Stop.** Do not fix anything here.
    - A criterion failed: it goes back to /build.
    - A criterion was not run: the developer decides whether to run it again or
      go on.
    - Anything else you saw is a finding: list it with a recommendation,
      following the findings rule in the workflow file.
    - Otherwise: the next stage is /review-changes.
