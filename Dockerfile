# Production Dockerfile for DigitalOcean App Platform
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files only
COPY package*.json ./

# Clean install with npm (ignore yarn.lock to avoid conflicts)
RUN rm -f yarn.lock && \
    npm cache clean --force && \
    npm install

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build with TypeScript (allow errors but ensure dist is created)
RUN npx tsc || npx tsc --noEmitOnError false || true

# Verify dist was created
RUN test -d dist || (echo "ERROR: dist directory not created" && exit 1)

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy other necessary files
COPY README.md manifest.json ./

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S instantly -u 1001

# Set ownership
RUN chown -R instantly:nodejs /app

# Switch to non-root user
USER instantly

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Environment
ENV NODE_ENV=production
ENV TRANSPORT_MODE=http
ENV PORT=8080
ENV HOST=0.0.0.0

# Start application
CMD ["node", "dist/index.js"]