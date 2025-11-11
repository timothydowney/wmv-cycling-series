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

# Stage 2: Production runtime
FROM node:24-slim

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1001 nodejs

# Copy built app from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/server ./server

# Install production dependencies only
RUN npm ci --omit=dev

# Create data directory for SQLite database
RUN mkdir -p /data && chown nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001), (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["npm", "start"]

