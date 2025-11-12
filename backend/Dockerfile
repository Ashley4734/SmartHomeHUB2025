# Multi-stage build for optimized production image

# Stage 1: Base image with dependencies
FROM node:20-alpine AS base

# Install system dependencies required for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Stage 2: Development dependencies
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Run in development mode
CMD ["npm", "run", "dev"]

# Stage 3: Build for production
FROM base AS builder

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Run tests
RUN npm run test || true

# Stage 4: Production image
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code from builder
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p data logs backups && \
    chown -R nodejs:nodejs data logs backups

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
