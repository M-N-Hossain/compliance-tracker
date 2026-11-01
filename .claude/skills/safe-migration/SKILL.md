---
name: safe-migration
description: Change the database schema safely, reviewing the generated SQL before it is applied. Use whenever prisma/schema.prisma needs to change, or when the developer runs /safe-migration.
# Load this skill when working on the schema file.
paths: prisma/schema.prisma
# scope: project means this skill stays in this repo, because it is about Prisma.
metadata:
  scope: project
---

# Change the schema safely

The developer runs both Prisma migrate commands in their own terminal, so they see
every prompt. Only the local development database is ever touched here.

## Steps

1. Read the spec's data model section, if there is a spec, and read
   `prisma/schema.prisma`. Explain the change in simple words.
2. Edit `prisma/schema.prisma`.
3. Give the developer this command, with a short name for the change:

   ```powershell
   npx prisma migrate dev --create-only --name <name>
   ```

   It writes the SQL file and does not apply it. Warn the developer: **if it offers
   to reset the database, answer no and show the message.** A reset deletes the
   development data. **Stop and wait.**

4. Read the new `migration.sql` and go through it with the developer, checking:
   - **Data loss:** any `DROP TABLE` or `DROP COLUMN`.
   - **Renames:** a drop and an add that should be one rename, which keeps the
     data. If so, correct the file, which asks for permission first.
   - **Defaults:** a `NOT NULL` column with no default on a table that has rows.
   - **Unique rules:** a new unique rule that existing rows may break.
5. **Stop and wait for approval of the SQL.**
6. Give the developer the command that applies it. **Stop and wait.**

   ```powershell
   npx prisma migrate dev
   ```

7. Run `npx prisma generate`, then the checks listed in CLAUDE.md that cover this
   change. If one fails, explain the root cause before fixing it.
8. The schema and the migration folder go in the same commit. Give the commit
   commands, or return to /build if this is part of a build step.

## Never

- Never edit a migration that has been applied. Write a new migration instead.
- Never run a command that resets, pushes to, or deploys to a database.
- Never open secret files.
