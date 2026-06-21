# =============================================================================
# Next.js Web Application - Dockerfile
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm --filter @charting-platform/web build

# =============================================================================
# Runtime Stage
# =============================================================================

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install serve for production
RUN npm install -g serve

# Copy built application
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./

# Expose port
EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["serve", "-s", ".next", "-l", "3000"]
