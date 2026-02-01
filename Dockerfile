# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source code and build frontend
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install all dependencies (need tsx to run server)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server source files
COPY --from=builder /app/server ./server

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

# Start the server using tsx (TypeScript execution)
CMD ["npx", "tsx", "server/index.ts"]
