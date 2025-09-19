# Single-stage build for DigitalOcean App Platform
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci --silent

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Copy additional files needed at runtime
COPY README.md ./
COPY manifest.json ./

# Install curl for health checks and remove dev dependencies after build
RUN apk add --no-cache curl && \
    npm ci --only=production --silent && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S instantly -u 1001 && \
    chown -R instantly:nodejs /app

USER instantly

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV TRANSPORT_MODE=http
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check disabled temporarily for debugging
# HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
#     CMD curl -f http://localhost:8080/health || exit 1

# Start the application directly
CMD ["node", "dist/index.js"]
