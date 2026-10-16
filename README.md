# Compliance Tracker

[![CI](https://github.com/M-N-Hossain/compliance-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/M-N-Hossain/compliance-tracker/actions/workflows/ci.yml)

A full-stack web app that helps small companies track certification requirements and document expiry dates.

It uses the Gemini API for two bounded tasks: classifying a company from its description, and extracting data from uploaded certificates. **AI never writes directly to canonical data.** Anything it cannot match sits in a pending-review queue until an admin approves it, and role-based access separates users from admins.

## Features

- **Company setup with AI classification:** describe what your company does, Gemini suggests a category, and you confirm or change it before saving.
- **Per-category checklists:** each category has its own required certificates, plus a shared "general" set that applies to every business (for example fire safety).
- **Certificate upload with AI extraction:** upload a PDF, Gemini reads the certificate type and expiry date, and suggests which checklist item it belongs to.
- **Human in the loop:** the AI's match is never saved automatically. A document is linked to a checklist item only when the user clicks Save.
- **Pending-review queue:** if a certificate does not match any checklist item, the user can submit it as a pending request. Admins approve or reject it, and can scope an approved item to all companies.
- **Authentication and roles:** email and password login with hashed passwords, JWT sessions, and protected routes for users and admins.

## Tech stack

| Area         | Tools                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Framework    | Next.js (App Router), TypeScript, Tailwind CSS                         |
| Database     | PostgreSQL 16 in Docker, Prisma ORM                                    |
| Auth         | Auth.js v5 (Credentials provider, bcrypt, JWT sessions)                |
| AI           | Google Gemini API with structured (schema-constrained) output          |
| File storage | Cloudflare R2                                                          |
| Containers   | Docker, Docker Compose (multi-stage image, one-shot migration service) |
| Code quality | ESLint, Prettier, TypeScript, Husky, lint-staged                       |
| CI           | GitHub Actions                                                         |

## Design decisions

- **AI suggests, humans decide.** Model output is always shown to the user for confirmation, and unmatched results go to an admin review queue instead of the database.
- **Constrained AI output.** Gemini answers with a fixed schema (an enum of allowed categories, plus a "NONE" option for certificates), which keeps the responses predictable.
- **Company lookup per request.** The company ID is read from the database using the session user ID, not stored in the JWT, so it can never go stale.
- **Secrets never go into an image.** The Docker image holds no keys. Docker Compose hands them to the running container at start.

## Getting started

### Option 1: run everything with Docker

**Requirements:** Docker Desktop, a Gemini API key, and a Cloudflare R2 bucket. The AI and upload features need real keys. Ports 3000 and 5432 must be free.

```bash
# 1. Clone
git clone https://github.com/M-N-Hossain/compliance-tracker.git
cd compliance-tracker

# 2. Create your environment file and fill in the values
cp .env.example .env

# 3. Build and start everything
docker compose up --build -d
```

Then open http://localhost:3000.

Useful commands:

```bash
docker compose logs -f app   # follow the app's log
docker compose down          # stop, and keep the database data
```

`docker compose down -v` also deletes the database data. Only use it when you want a completely empty start.

The values in `.env.example` are fine for a throwaway local database. Never use them on a real server.

`AUTH_SECRET` must be your own random value. Docker Compose reads `.env` only. If you have Node, `npx auth secret` works, but it writes the value to `.env.local`, so copy it from there into `.env`. With only Docker, this prints a value you can paste into `.env`:

```bash
docker run --rm node:24-slim node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Option 2: develop on your own machine

**Requirements:** Node.js 22 or newer, Docker Desktop, a Gemini API key, and a Cloudflare R2 bucket.

```bash
# 1. Clone and install
git clone https://github.com/M-N-Hossain/compliance-tracker.git
cd compliance-tracker
npm install

# 2. Create your environment file and fill in the values
cp .env.example .env

# 3. Start only PostgreSQL
docker compose up -d db

# 4. Create the tables and seed the requirement templates
npx prisma migrate dev
npx prisma db seed

# 5. Run the app
npm run dev
```

Then open http://localhost:3000. In this mode `DATABASE_URL` in `.env` uses `localhost`.

Generate `AUTH_SECRET` with `npx auth secret`. It writes the value to `.env.local`, which `npm run dev` reads before `.env`.

## How the Docker setup works

`docker compose up` starts three containers in a fixed order:

1. **db:** PostgreSQL 16, with its data in a named volume. A healthcheck tells Compose when it is ready.
2. **migrate:** a one-time job. It applies the database migrations, seeds the requirement templates, and exits. Running it again is safe, because it only applies what is missing.
3. **app:** the website. It starts only after `db` is healthy and `migrate` has finished successfully.

The Dockerfile builds in stages, so the final image stays small:

| Stage     | Job                                                                        |
| --------- | -------------------------------------------------------------------------- |
| `deps`    | Installs the packages                                                      |
| `builder` | Generates the Prisma client and builds the app (Next.js standalone output) |
| `migrate` | The migration job above, built on top of `builder`                         |
| `runner`  | The final image: only the standalone server, running as a non-root user    |

Secrets are passed in when the container starts, `.dockerignore` keeps `.env` out of the build, and the placeholder values used during the build never reach the final image.

## Code quality

Every change is checked automatically at two levels:

- **Locally:** a Husky pre-commit hook runs ESLint and Prettier on staged files and blocks the commit if something is wrong.
- **On GitHub:** a GitHub Actions workflow runs ESLint, Prettier and the TypeScript check on every push and pull request.

Run all checks yourself with:

```bash
npm run check
```

## Status

Work in progress. Authentication, company setup, AI classification, certificate upload and extraction, checklist matching, the admin review queue, the dashboard with status indicators and the Docker setup are working. Deployment is next.
