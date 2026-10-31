# Compliance Tracker

Learning project. I want to understand each step, not only get it working.

## How to work with me

- Do one small step at a time, then stop and wait for me to say "go".
- Before writing code, explain the idea in simple words (a short story or diagram).
- Put a short comment on every part of the code you write.
- When something fails, explain the root cause before you fix it.
- Never apply a change I could not explain back to you.
- No em dashes in anything you write.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind v4 (tokens in globals.css @theme)
- Prisma (prisma-client generator, output app/generated/prisma, PrismaPg adapter in lib/prisma.ts)
- PostgreSQL in Docker, Auth.js v5 (Credentials, JWT, proxy.ts)
- Cloudflare R2 (private bucket), Gemini API (lib/gemini.ts)

## Commands

- Dev server: npm run dev
- Lint: npm run lint
- Prisma client: npx prisma generate
- New migration (dev): npx prisma migrate dev
- Whole stack (db, migrate, app): docker compose up --build -d
- Database only (for npm run dev): docker compose up -d db
- Stop and keep the data: docker compose down
- Check (lint, format, types): npm run check
- Unit tests (no Docker): npm run test:unit
- All Vitest tests: npm test
- Browser test: npm run test:e2e
- Hook test: node test/hook-test/block-destructive.test.mjs
- Start test database (needed by npm test and test:e2e): npm run test:db:up
- Stop test database and delete its data: npm run test:db:down

Every test goes under test/, in a folder for its kind (util-test, api-test and so on). Helpers that are not tests go in test/support/.

## Docker

- Dockerfile stages: deps, builder, migrate, runner. runner must stay the LAST stage, because the app service builds the last stage.
- The migrate service applies migrations and the seed, then exits. The app waits for it.
- To test on an empty database, use a separate project: docker compose -p ct-fresh up --build -d, and clean up with docker compose -p ct-fresh down -v. Never use -v without -p ct-fresh.

## Security rules

- Never read, print or paste the contents of .env or any secret.
- Never put secrets in a Dockerfile or an image. Pass them at run time.
- Ask me before installing a new package.
- Never run "docker compose down -v", "docker volume prune" or "docker system prune --volumes". The development database lives in a Docker volume. Ask me first.
