# stage one: deps
# "slim" is a smaller Debian Linux. We avoid "alpine" because some packages break on it.
FROM node:24-slim AS deps

# Make /app the working folder.
WORKDIR /app

# Tell Husky to skip installing git hooks (there is no git inside the image).
ENV HUSKY=0

# Copy ONLY the package list and the lockfile.
COPY package.json package-lock.json ./

# Install the exact versions from the lockfile.
RUN npm ci

# Stage 2: build the app
FROM node:24-slim AS builder

# Work folder for this stage.
WORKDIR /app

# Take ONLY the installed packages from stage 1 (reuses its cached install).
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the project (minus what .dockerignore hides).
# node_modules is ignored, so this cannot overwrite the packages copied above.
COPY . .

# Stop Next.js from sending anonymous usage data during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# FAKE values, only so the build can load our modules. They are not real keys.
# This ENV lives in the builder stage only. The final image never sees it.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-placeholder" \
    GEMINI_API_KEY="build-placeholder" \
    R2_ACCOUNT_ID="build-placeholder" \
    R2_ACCESS_KEY_ID="build-placeholder" \
    R2_SECRET_ACCESS_KEY="build-placeholder" \
    R2_BUCKET="build-placeholder"

# Generate the Prisma client into app/generated/prisma (the build needs it to compile).
RUN npx prisma generate

# Build the app. Because of output: "standalone", this also creates .next/standalone.
RUN npm run build

# Stage 2b: migrate (a short-lived job image: create tables, then insert seed data)
# Built on top of "builder", so it already has node_modules, prisma/, prisma.config.ts
# and the generated client. It is NOT the image users talk to.
FROM builder AS migrate

# Prisma's schema engine needs OpenSSL, and node:slim does not include it.
# --no-install-recommends keeps it small; the last part deletes the package lists.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Create or update the tables, then insert the seed rows.
# "&&" means: run the seed only if the migration succeeded.
# DATABASE_URL arrives when compose starts this container.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]


# Stage 3: the image that actually runs (and ships)
# A brand new stage: it inherits NOTHING from the builder, not even the fake ENV values.
FROM node:24-slim AS runner

# Work folder for this stage.
WORKDIR /app

# Production mode, telemetry off.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# server.js reads these when the container starts.
# 0.0.0.0 = "listen on every network door", otherwise your browser cannot reach it.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The finished server (server.js + traced packages + compiled routes).
# --chown makes the "node" user the owner, so it may write to its own folders.
COPY --from=builder --chown=node:node /app/.next/standalone ./

# Standalone leaves these two out on purpose, so we add them by hand.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# From here on, run as the unprivileged "node" user instead of root.
USER node

# Documentation only: "this container listens on 3000". It does not open anything.
EXPOSE 3000

# What runs when the container starts. No npm, no next CLI, just node.
CMD ["node", "server.js"]