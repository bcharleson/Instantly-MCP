# Multi-stage build for production deployment on Digital Ocean
# Optimized for minimal size and maximum security

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --silent

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S instantly -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/

# Copy essential files
COPY README.md ./
COPY manifest.json ./

# Change ownership to non-root user
RUN chown -R instantly:nodejs /app
USER instantly

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV TRANSPORT_MODE=http
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application directly
CMD ["node", "dist/index.js"]
