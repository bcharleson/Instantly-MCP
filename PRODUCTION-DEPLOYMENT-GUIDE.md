# Instantly MCP Server - Production Deployment Guide

**Date:** 2025-09-30  
**Version:** V1 Production Ready  
**Target:** Instantly.ai DigitalOcean Account

---

## 📋 **Current Deployment Specifications**

### **DigitalOcean App Platform Configuration**

**Current Setup (Development/Testing):**
- **Platform:** DigitalOcean App Platform (PaaS)
- **Region:** NYC (nyc)
- **Instance Size:** `basic-xxs` (512MB RAM, 1 vCPU)
- **Instance Count:** 1
- **Node.js Version:** 18.x (LTS)
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run start:production` → `node dist/index.js`
- **Port:** 8080
- **Environment:** Production

**Current URL:**
```
https://instantly-mcp-iyjln.ondigitalocean.app/mcp
```

---

## 🚀 **Production Deployment for Instantly.ai**

### **Step 1: Create New App in Instantly's DigitalOcean Account**

1. **Log into DigitalOcean Dashboard**
   - Navigate to: https://cloud.digitalocean.com/apps
   - Click "Create App"

2. **Connect GitHub Repository**
   - Select "GitHub" as source
   - Authorize DigitalOcean to access `Instantly-ai/mcp-instantly` repository
   - Select branch: `main` (after PR is merged)
   - Enable "Autodeploy" on push to main

3. **Configure Build Settings**
   - **Source Directory:** `/` (root)
   - **Build Command:** `npm ci && npm run build`
   - **Run Command:** `npm run start:production`
   - **Environment:** Node.js
   - **Node Version:** 18.x

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   TRANSPORT_MODE=http
   PORT=8080
   HOST=0.0.0.0
   ENVIRONMENT=production
   ```

5. **Configure Instance Size (See Scaling Recommendations Below)**

6. **Configure Health Check**
   - **HTTP Path:** `/health`
   - **Initial Delay:** 30 seconds
   - **Period:** 10 seconds
   - **Timeout:** 5 seconds
   - **Success Threshold:** 1
   - **Failure Threshold:** 3

7. **Configure Alerts**
   - CPU Utilization > 80%
   - Memory Utilization > 80%
   - Restart Count > 5

---

## 📊 **Scaling Recommendations for Production**

### **Traffic Scenarios & Instance Sizing**

#### **Scenario 1: Small Scale (100-500 concurrent users)**
**Recommended Instance:** `basic-xs`
- **RAM:** 1GB
- **vCPU:** 1
- **Instance Count:** 2 (for redundancy)
- **Cost:** ~$10/month per instance = **$20/month**
- **Max Concurrent Connections:** ~500-1000
- **Requests per Second:** ~50-100 RPS

**Configuration:**
```yaml
instance_size_slug: basic-xs
instance_count: 2
```

#### **Scenario 2: Medium Scale (500-2000 concurrent users)**
**Recommended Instance:** `basic-s`
- **RAM:** 2GB
- **vCPU:** 1
- **Instance Count:** 3 (for load distribution)
- **Cost:** ~$20/month per instance = **$60/month**
- **Max Concurrent Connections:** ~2000-4000
- **Requests per Second:** ~200-400 RPS

**Configuration:**
```yaml
instance_size_slug: basic-s
instance_count: 3
```

#### **Scenario 3: Large Scale (2000-10000 concurrent users)**
**Recommended Instance:** `professional-xs`
- **RAM:** 2GB
- **vCPU:** 2
- **Instance Count:** 5 (horizontal scaling)
- **Cost:** ~$40/month per instance = **$200/month**
- **Max Concurrent Connections:** ~10000-20000
- **Requests per Second:** ~1000-2000 RPS

**Configuration:**
```yaml
instance_size_slug: professional-xs
instance_count: 5
```

#### **Scenario 4: Enterprise Scale (10000+ concurrent users)**
**Recommended Instance:** `professional-s`
- **RAM:** 4GB
- **vCPU:** 2
- **Instance Count:** 10+ (auto-scaling)
- **Cost:** ~$80/month per instance = **$800+/month**
- **Max Concurrent Connections:** 50000+
- **Requests per Second:** 5000+ RPS

**Configuration:**
```yaml
instance_size_slug: professional-s
instance_count: 10
```

---

## ⚙️ **Technical Specifications & Limitations**

### **Per-Instance Limits**

**Current Configuration (basic-xxs):**
- **Max Concurrent Connections:** ~100-200
- **Memory Usage:** ~200-300MB baseline
- **CPU Usage:** ~10-20% baseline
- **Request Timeout:** 30 seconds (configurable)
- **Max Request Size:** 10MB (DigitalOcean default)

**Recommended Production Configuration (basic-xs or higher):**
- **Max Concurrent Connections:** 500-1000 per instance
- **Memory Usage:** ~400-600MB under load
- **CPU Usage:** ~30-50% under load
- **Request Timeout:** 30 seconds
- **Connection Timeout:** 60 seconds

### **Rate Limiting Recommendations**

**Per-User Rate Limits:**
```javascript
// Recommended rate limits for production
{
  windowMs: 60000,        // 1 minute
  max: 100,               // 100 requests per minute per user
  message: "Too many requests, please try again later"
}
```

**Global Rate Limits:**
```javascript
// Recommended global rate limits
{
  windowMs: 60000,        // 1 minute
  max: 1000,              // 1000 requests per minute globally
  message: "Server is busy, please try again later"
}
```

**Implementation:** Rate limiting is currently handled by the MCP SDK. For production, consider adding express-rate-limit middleware.

### **Instantly.ai API Rate Limits**

**Important:** The MCP server makes requests to Instantly.ai API, which has its own rate limits:
- **Rate Limit:** Unknown (check with Instantly.ai backend team)
- **Recommendation:** Implement request queuing and retry logic
- **Current Implementation:** Basic rate limiting in `src/rate-limiter.ts`

---

## 🔧 **Production Configuration File**

**File:** `.do/app.yaml` (for DigitalOcean App Platform)

```yaml
name: Instantly MCP Production
region: nyc

services:
- name: mcp-server-production
  source_dir: /
  github:
    repo: Instantly-ai/mcp-instantly
    branch: main
    deploy_on_push: true

  build_command: npm ci && npm run build
  run_command: npm run start:production
  
  environment_slug: node-js
  instance_count: 2              # Start with 2 for redundancy
  instance_size_slug: basic-xs   # 1GB RAM, 1 vCPU
  
  envs:
  - key: NODE_ENV
    value: production
  - key: TRANSPORT_MODE
    value: http
  - key: PORT
    value: "8080"
  - key: HOST
    value: "0.0.0.0"
  - key: ENVIRONMENT
    value: production
  
  health_check:
    http_path: /health
    initial_delay_seconds: 30
    period_seconds: 10
    timeout_seconds: 5
    success_threshold: 1
    failure_threshold: 3
  
  http_port: 8080
  
  routes:
  - path: /
    preserve_path_prefix: true

alerts:
- rule: CPU_UTILIZATION
  disabled: false
  value: 80
- rule: MEM_UTILIZATION
  disabled: false
  value: 80
- rule: RESTART_COUNT
  disabled: false
  value: 5
```

---

## 📈 **Monitoring & Observability**

### **Built-in DigitalOcean Monitoring**

**Metrics Available:**
- CPU utilization
- Memory utilization
- Bandwidth usage
- Request count
- Response time
- Error rate

**Access:** DigitalOcean Dashboard → Apps → Instantly MCP Production → Insights

### **Recommended Additional Monitoring**

1. **Application Performance Monitoring (APM):**
   - Consider: New Relic, Datadog, or Sentry
   - Monitor: Request latency, error rates, throughput

2. **Log Aggregation:**
   - DigitalOcean provides basic logs
   - Consider: Papertrail, Loggly, or ELK stack for advanced analysis

3. **Uptime Monitoring:**
   - Consider: UptimeRobot, Pingdom, or StatusCake
   - Monitor: `/health` endpoint availability

### **Health Check Endpoint**

**URL:** `https://your-domain.com/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.1.0"
}
```

---

## 🔒 **Security Considerations**

### **Authentication**

**Current Implementation:**
- URL-based authentication: `/mcp/{API_KEY}`
- Header-based authentication: `Authorization: Bearer {API_KEY}`

**Production Recommendations:**
1. Use header-based authentication only (more secure)
2. Rotate API keys regularly
3. Implement API key scoping (per-user, per-organization)
4. Add rate limiting per API key

### **HTTPS/TLS**

**DigitalOcean App Platform:**
- Automatic SSL/TLS certificates via Let's Encrypt
- Automatic renewal
- HTTPS enforced by default

**Custom Domain:**
- SSL certificate automatically provisioned
- No manual configuration needed

### **DDoS Protection**

**DigitalOcean Built-in:**
- Basic DDoS protection included
- Automatic traffic filtering

**Additional Recommendations:**
- Consider Cloudflare for advanced DDoS protection
- Implement rate limiting (see above)
- Monitor for unusual traffic patterns

---

## 🚨 **Error Recovery & Resilience**

### **Automatic Restart**

**DigitalOcean App Platform:**
- Automatic restart on crash
- Health check-based restart
- Alert on restart count > 5

### **Graceful Shutdown**

**Current Implementation:**
```javascript
// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // Close server, cleanup connections
  process.exit(0);
});
```

### **Connection Pooling**

**Current Implementation:**
- HTTP keep-alive enabled
- Connection reuse for Instantly.ai API calls

**Recommendation:** Monitor connection pool size and adjust based on load

---

## 💰 **Cost Estimates**

### **Monthly Cost Breakdown**

| Scenario | Instance Size | Count | Cost/Instance | Total/Month |
|----------|---------------|-------|---------------|-------------|
| Development | basic-xxs | 1 | $5 | **$5** |
| Small (100-500 users) | basic-xs | 2 | $10 | **$20** |
| Medium (500-2000 users) | basic-s | 3 | $20 | **$60** |
| Large (2000-10000 users) | professional-xs | 5 | $40 | **$200** |
| Enterprise (10000+ users) | professional-s | 10 | $80 | **$800** |

**Additional Costs:**
- Bandwidth: Included (1TB/month per instance)
- Custom domain: Free
- SSL certificate: Free (Let's Encrypt)
- Monitoring: Included (basic)

**Note:** Prices are approximate and may vary. Check DigitalOcean pricing for exact costs.

---

## 📝 **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Repository transferred to `Instantly-ai/mcp-instantly`
- [ ] PR merged to `main` branch
- [ ] All tests passing (Phase 1-3 validation)
- [ ] Environment variables documented
- [ ] Custom domain DNS configured (see CUSTOM-DOMAIN-GUIDE.md)

### **Deployment:**
- [ ] Create new app in Instantly's DigitalOcean account
- [ ] Connect GitHub repository
- [ ] Configure build settings
- [ ] Set environment variables
- [ ] Configure instance size (start with basic-xs)
- [ ] Configure health checks
- [ ] Configure alerts
- [ ] Deploy and verify

### **Post-Deployment:**
- [ ] Verify `/health` endpoint responds
- [ ] Test MCP server with Claude Desktop
- [ ] Test multi-step campaign creation
- [ ] Monitor logs for errors
- [ ] Set up uptime monitoring
- [ ] Document production URL
- [ ] Update README with production URL

---

## 🔗 **Related Documentation**

- **Custom Domain Setup:** See `CUSTOM-DOMAIN-GUIDE.md`
- **V2 Roadmap:** See `V2-ROADMAP.md` (to be created)
- **API Documentation:** See README.md

---

## 📞 **Support & Troubleshooting**

**Common Issues:**

1. **Build Fails:**
   - Check Node.js version (must be 18.x)
   - Verify `npm ci` runs successfully
   - Check TypeScript compilation errors

2. **Health Check Fails:**
   - Verify `/health` endpoint is accessible
   - Check port configuration (8080)
   - Verify server starts successfully

3. **High Memory Usage:**
   - Increase instance size
   - Check for memory leaks
   - Monitor connection pool size

4. **High CPU Usage:**
   - Increase instance size or count
   - Optimize API calls
   - Implement caching

**Contact:**
- Brandon Charleson (bcharleson@users.noreply.github.com)
- Instantly.ai Team

---

**Last Updated:** 2025-09-30  
**Version:** 1.0  
**Status:** Production Ready

