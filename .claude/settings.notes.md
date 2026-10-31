# Notes on settings.json

settings.json is strict JSON and cannot hold comments, so they live here.
Rules are checked in the order deny, ask, allow. An allow rule can never undo a deny rule.

G = generic, move to user settings later. P = specific to this project.

## Modes

| Setting                        | Why                                               | Type |
| ------------------------------ | ------------------------------------------------- | ---- |
| `disableBypassPermissionsMode` | Nobody can start a session that skips all rules   | G    |
| `disableAutoMode`              | Keeps my approval prompts instead of a classifier | G    |

## Deny

| Rule                                               | Why                                             | Type |
| -------------------------------------------------- | ----------------------------------------------- | ---- |
| `PowerShell`                                       | One shell for Claude, so rules are written once | G    |
| `Read(.env)`, `Read(.env.*)`                       | Secrets. Also blocks Edit and Write on them     | G    |
| `Read(!.env.example)`, `Read(!.env.test)`          | Exceptions: these two only hold fake values     | G    |
| `docker compose *down*-v*`                         | Deletes volumes. Also matches `--volumes`       | G    |
| `docker volume rm`, `volume prune`, `system prune` | Can delete the dev database volume              | G    |
| `prisma migrate reset`, `db execute`               | Wipes data, or runs raw SQL                     | P    |
| `prisma migrate deploy`                            | Only Docker and the guarded test setup run it   | P    |
| `prisma db push` with data loss flags              | Can drop data without a migration               | P    |
| `git push` with force or delete                    | Rewrites or removes remote history              | G    |
| `git reset --hard`, `git clean`, `git branch -D`   | Destroys local work that cannot be recovered    | G    |
| `git diff --no-index`                              | Would print any file, including `.env`          | G    |
| `git diff --output`, `git log --output`            | Would write files through an allowed command    | G    |

## Ask

| Rule                          | Why                                | Type |
| ----------------------------- | ---------------------------------- | ---- |
| `git push`, `gh`              | Anything that leaves this machine  | G    |
| `Edit(/prisma/migrations/**)` | Applied migrations must not change | P    |

## Allow

Exact everyday commands only, and no wildcard after `npx`.

| Rule                                        | Type |
| ------------------------------------------- | ---- |
| `npm run check`, `npm run lint`, `npm test` | G    |
| `git status`, `git diff`, `git log`         | G    |
| `npx prisma generate`                       | P    |

## Hook

`hooks/block-destructive.mjs` runs before every Bash command (G, except its Prisma rules, P).
It rewrites the command into a plain form, blocks the destructive list with exit code 2, and
makes every `git push` ask, however it is worded. Test it with
`node .claude/hooks/block-destructive.test.mjs`.

## Limits

The rules compare command text. `git -C . push` does not match `git push`, and a script that
opens a file itself is not covered by a Read rule. See the docs page on permissions.

The hook reads text too. It catches rewordings, but not a command hidden in a variable, a git
alias, an npm script, or a script file. Native Windows has no sandbox, so CI and the GitHub
settings remain the real gate.

The hook blocks too much on purpose: a commit message that mentions `git clean` is refused.

## settings.local.json

Personal and gitignored, because the brain's path is specific to one machine (G, the path is P).

- Allows Read and Edit only in the brain's `projects/compliance-tracker/` folder.
- Denies every other brain folder and file by name. An exception cannot be carved out of a
  rule with an absolute path, so a single "deny the whole brain" rule is not possible.
- A new brain folder is not on the list, so it gets a prompt, not a refusal. Add it to the list.
- The brain's `CLAUDE.md` and `README.md` are left off both lists on purpose. /record must read
  them, so they get a prompt each time.
