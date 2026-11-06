# syntax=docker/dockerfile:1.7
#
# Kinshift production image.
#   docker build -t kinshift .
#   docker run -p 3000:3000 -v kinshift-data:/data kinshift

ARG NODE_VERSION=24

# 1. Install dependencies. better-sqlite3 ships prebuilt binaries for every
#    supported platform, so no compiler or install scripts are needed.
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

# 2. Build the standalone Next.js server.
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ARG KINSHIFT_BUILD_NUMBER=local
ARG KINSHIFT_COMMIT_SHA=unknown
ARG KINSHIFT_BUILD_DATE=""
ENV NEXT_TELEMETRY_DISABLED=1 \
    KINSHIFT_BUILD_NUMBER=${KINSHIFT_BUILD_NUMBER} \
    KINSHIFT_COMMIT_SHA=${KINSHIFT_COMMIT_SHA} \
    KINSHIFT_BUILD_DATE=${KINSHIFT_BUILD_DATE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Small runtime image running as a non-root user.
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG VERSION=dev
ARG KINSHIFT_COMMIT_SHA=unknown
ARG KINSHIFT_BUILD_DATE=""
LABEL org.opencontainers.image.title="Kinshift" \
      org.opencontainers.image.description="The family caregiver hub: shared medications, care shifts, appointments and an encrypted care journal." \
      org.opencontainers.image.source="https://github.com/lobojoel2003/Kinshift" \
      org.opencontainers.image.url="https://github.com/lobojoel2003/Kinshift" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${KINSHIFT_COMMIT_SHA}" \
      org.opencontainers.image.created="${KINSHIFT_BUILD_DATE}"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

WORKDIR /app
RUN groupadd --system --gid 1001 kinshift \
  && useradd --system --uid 1001 --gid kinshift --home /app kinshift \
  && mkdir -p /data \
  && chown kinshift:kinshift /data

COPY --from=build --chown=kinshift:kinshift /app/.next/standalone ./
COPY --from=build --chown=kinshift:kinshift /app/.next/static ./.next/static
COPY --from=build --chown=kinshift:kinshift /app/public ./public
COPY --from=build --chown=kinshift:kinshift /app/drizzle ./drizzle

USER kinshift
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
