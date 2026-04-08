FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Full production node_modules — needed for Prisma CLI (migrate deploy) in entrypoint.sh.
# Prisma's transitive deps span multiple package namespaces so a surgical copy isn't viable.
COPY --from=prod-deps /app/node_modules ./node_modules

# Standalone output copies on top (its minimal node_modules subset takes precedence)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3567
ENV PORT=3567
ENV HOSTNAME="0.0.0.0"
CMD ["./entrypoint.sh"]
