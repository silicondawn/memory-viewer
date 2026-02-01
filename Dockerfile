# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Fix ServerWebSocket type issue by replacing with any type
RUN sed -i 's/import type { ServerWebSocket } from "@hono\/node-ws";/type ServerWebSocket = any;/' server/index.ts

# Compile TypeScript server to JavaScript
RUN npx tsc --project tsconfig.server.json

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy compiled server JavaScript
COPY --from=builder /app/server-dist ./server-dist

# Create workspace directory for memory files
RUN mkdir -p /app/workspace && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the default port
EXPOSE 8901

# Set production environment
ENV NODE_ENV=production
ENV PORT=8901
ENV WORKSPACE_DIR=/app/workspace
ENV STATIC_DIR=/app/dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8901/api/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the server using compiled JavaScript
CMD ["node", "server-dist/index.js"]
