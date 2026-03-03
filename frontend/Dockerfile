# ---- deps stage ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ---- builder stage ----
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (injected via --build-arg / GitHub Actions secrets)
ARG NEXT_PUBLIC_API_URL
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

# Make them available to the Next.js build process
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL

RUN bun run build

# ---- runner stage ----
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# NEXTAUTH_URL and NEXTAUTH_SECRET are also runtime vars; pass them via env_file in compose
CMD ["bun", "start"]
