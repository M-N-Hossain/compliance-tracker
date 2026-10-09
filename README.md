# Compliance Tracker

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

| Area         | Tools                                                         |
| ------------ | ------------------------------------------------------------- |
| Framework    | Next.js (App Router), TypeScript, Tailwind CSS                |
| Database     | PostgreSQL 16 in Docker, Prisma ORM                           |
| Auth         | Auth.js v5 (Credentials provider, bcrypt, JWT sessions)       |
| AI           | Google Gemini API with structured (schema-constrained) output |
| File storage | Cloudflare R2                                                 |
| Code quality | ESLint, Prettier, TypeScript, Husky, lint-staged              |
| CI           | GitHub Actions                                                |

## Design decisions

- **AI suggests, humans decide.** Model output is always shown to the user for confirmation, and unmatched results go to an admin review queue instead of the database.
- **Constrained AI output.** Gemini answers with a fixed schema (an enum of allowed categories, plus a "NONE" option for certificates), which keeps the responses predictable.
- **Company lookup per request.** The company ID is read from the database using the session user ID, not stored in the JWT, so it can never go stale.

## Getting started

**Requirements:** Node.js 22, Docker Desktop, a Gemini API key, and a Cloudflare R2 bucket.

```bash
# 1. Clone and install
git clone https://github.com/YOUR-USERNAME/compliance-tracker.git
cd compliance-tracker
npm install

# 2. Create your environment file and fill in the values
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d

# 4. Create the tables and seed the requirement templates
npx prisma migrate dev
npx prisma db seed

# 5. Run the app
npm run dev
```

Then open http://localhost:3000.

Generate `AUTH_SECRET` with `npx auth secret`.

## Code quality

Every change is checked automatically at two levels:

- **Locally:** a Husky pre-commit hook runs ESLint and Prettier on staged files and blocks the commit if something is wrong.
- **On GitHub:** a GitHub Actions workflow runs ESLint, Prettier and the TypeScript check on every push and pull request.

Run all checks yourself with:

```bash
npm run check
```

## Status

Work in progress. Authentication, company setup, AI classification, certificate upload and extraction, checklist matching and the admin review queue are working. Dashboard status indicators are next.
