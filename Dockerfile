# WMV Cycling Series - Production Dockerfile
# Multi-stage build for optimization
# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build:frontend

############################################
# Stage 2: Production runtime (no rebuilds)
# We copy pre-built artifacts & node_modules
############################################
FROM node:24-slim AS runtime

WORKDIR /app

## Only runtime utilities (no build chain needed because we copy compiled native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
  dumb-init \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1001 nodejs

## Copy root package metadata first (for clarity)
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

## Copy already-installed node_modules (frontend deps)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

## Copy server code + its node_modules (contains better-sqlite3 compiled in builder)
COPY --from=builder --chown=nodejs:nodejs /app/server ./server
COPY --from=builder --chown=nodejs:nodejs /app/server/node_modules ./server/node_modules

## Copy built frontend assets
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

## Dedicated volume mount point for SQLite (configure DATABASE_PATH=/data/wmv.db in Railway)
RUN mkdir -p /data && chown nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001), (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

# Use dumb-init to handle signals
ENV NODE_ENV=production \
  HOST=0.0.0.0

ENTRYPOINT ["dumb-init", "--"]

# Start the server
## Root package.json start script delegates to server
CMD ["npm", "start"]

