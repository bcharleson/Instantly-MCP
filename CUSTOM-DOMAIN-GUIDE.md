# Custom Domain Configuration Guide - mcp.instantly.ai

**Target Domain:** `mcp.instantly.ai/mcp`  
**Current URL:** `https://instantly-mcp-iyjln.ondigitalocean.app/mcp`  
**Platform:** DigitalOcean App Platform

---

## 📋 **Overview**

This guide provides step-by-step instructions for configuring the custom domain `mcp.instantly.ai` for the Instantly MCP Server, replacing the default DigitalOcean App Platform URL.

---

## 🌐 **Step 1: DNS Configuration**

### **Option A: Using Cloudflare (Recommended)**

**Benefits:**
- Free SSL/TLS
- DDoS protection
- CDN capabilities
- Advanced analytics

**Steps:**

1. **Log into Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com
   - Select the `instantly.ai` domain

2. **Add DNS Record**
   - Go to: DNS → Records
   - Click "Add record"
   - Configure:
     ```
     Type: CNAME
     Name: mcp
     Target: instantly-mcp-production.ondigitalocean.app
     Proxy status: Proxied (orange cloud)
     TTL: Auto
     ```

3. **SSL/TLS Settings**
   - Go to: SSL/TLS → Overview
   - Set encryption mode: **Full (strict)**
   - This ensures end-to-end encryption

4. **Page Rules (Optional but Recommended)**
   - Go to: Rules → Page Rules
   - Create rule for `mcp.instantly.ai/*`
   - Settings:
     - Cache Level: Standard
     - Browser Cache TTL: 4 hours
     - Security Level: Medium

**DNS Propagation:** 5-30 minutes (usually instant with Cloudflare)

---

### **Option B: Using DigitalOcean DNS**

**Steps:**

1. **Log into DigitalOcean Dashboard**
   - Navigate to: https://cloud.digitalocean.com/networking/domains
   - Select `instantly.ai` domain (or add it if not present)

2. **Add DNS Record**
   - Click "Add Record"
   - Configure:
     ```
     Type: CNAME
     Hostname: mcp
     Will Direct To: instantly-mcp-production.ondigitalocean.app.
     TTL: 3600 (1 hour)
     ```

3. **Verify DNS Record**
   ```bash
   dig mcp.instantly.ai
   # Should show CNAME pointing to DigitalOcean app
   ```

**DNS Propagation:** 30 minutes to 24 hours

---

### **Option C: Using Other DNS Providers (GoDaddy, Namecheap, etc.)**

**Generic Steps:**

1. **Log into DNS Provider Dashboard**
2. **Navigate to DNS Management** for `instantly.ai`
3. **Add CNAME Record:**
   ```
   Type: CNAME
   Host/Name: mcp
   Points to/Target: instantly-mcp-production.ondigitalocean.app
   TTL: 3600 (or default)
   ```
4. **Save Changes**

**DNS Propagation:** 30 minutes to 48 hours (varies by provider)

---

## 🔧 **Step 2: DigitalOcean App Platform Domain Configuration**

### **Add Custom Domain to App**

1. **Navigate to App Settings**
   - Go to: https://cloud.digitalocean.com/apps
   - Select: "Instantly MCP Production" app
   - Click: "Settings" tab

2. **Add Domain**
   - Scroll to: "Domains" section
   - Click: "Add Domain"
   - Enter: `mcp.instantly.ai`
   - Click: "Add Domain"

3. **Verify Domain Ownership**
   - DigitalOcean will automatically verify the CNAME record
   - Status will change from "Pending" to "Active" once verified
   - This usually takes 5-10 minutes

4. **SSL Certificate Provisioning**
   - DigitalOcean automatically provisions a Let's Encrypt SSL certificate
   - Certificate is automatically renewed every 90 days
   - No manual configuration needed
   - Status: "Certificate Active" when ready

5. **Set as Primary Domain (Optional)**
   - In the Domains section, click the three dots next to `mcp.instantly.ai`
   - Select "Set as Primary"
   - This makes it the default domain for the app

---

## 🛣️ **Step 3: URL Path Configuration (/mcp)**

### **Understanding the Path Structure**

**Target URL:** `https://mcp.instantly.ai/mcp`

**Current Implementation:**
- The MCP server listens on all paths: `/`
- The `/mcp` path is handled by the application routing
- No special DigitalOcean configuration needed

**How It Works:**
```javascript
// In src/index.ts
app.post('/mcp', async (req, res) => {
  // Handle MCP requests
});

app.get('/health', (req, res) => {
  // Health check endpoint
});
```

### **Verification**

After domain is configured, test these endpoints:

```bash
# Health check
curl https://mcp.instantly.ai/health

# MCP endpoint (requires authentication)
curl -X POST https://mcp.instantly.ai/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'
```

---

## 🔄 **Step 4: Update MCP Client Configurations**

### **Claude Desktop Configuration**

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

**Before:**
```json
{
  "mcpServers": {
    "instantly": {
      "url": "https://instantly-mcp-iyjln.ondigitalocean.app/mcp/YOUR_API_KEY"
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "instantly": {
      "url": "https://mcp.instantly.ai/mcp/YOUR_API_KEY"
    }
  }
}
```

### **n8n Configuration**

**Before:**
```
Server URL: https://instantly-mcp-iyjln.ondigitalocean.app/mcp
```

**After:**
```
Server URL: https://mcp.instantly.ai/mcp
```

### **MCP Inspector Configuration**

**Before:**
```
URL: https://instantly-mcp-iyjln.ondigitalocean.app/mcp/YOUR_API_KEY
```

**After:**
```
URL: https://mcp.instantly.ai/mcp/YOUR_API_KEY
```

---

## 🔒 **Step 5: SSL/TLS Certificate Verification**

### **Verify Certificate**

```bash
# Check SSL certificate
openssl s_client -connect mcp.instantly.ai:443 -servername mcp.instantly.ai

# Should show:
# - Issuer: Let's Encrypt
# - Valid from: [date]
# - Valid to: [date + 90 days]
# - Subject: CN=mcp.instantly.ai
```

### **Test HTTPS**

```bash
# Should return 200 OK
curl -I https://mcp.instantly.ai/health

# Should NOT work (HTTP redirects to HTTPS)
curl -I http://mcp.instantly.ai/health
```

---

## 🔄 **Step 6: Backward Compatibility (Optional)**

### **Keep Old URL Active**

**Recommendation:** Keep the old DigitalOcean URL active for 30-60 days to allow users to migrate.

**How:**
- The old URL (`*.ondigitalocean.app`) remains active automatically
- Both URLs point to the same app
- No additional configuration needed

**Migration Plan:**
1. **Week 1-2:** Announce new domain, both URLs work
2. **Week 3-4:** Send migration reminders
3. **Week 5-6:** Final migration deadline
4. **Week 7+:** Consider deprecating old URL (optional)

**Note:** DigitalOcean App Platform URLs cannot be disabled, so the old URL will always work. This is actually beneficial for backward compatibility.

---

## 📊 **Step 7: Monitoring & Verification**

### **DNS Propagation Check**

```bash
# Check DNS resolution
dig mcp.instantly.ai

# Check from multiple locations
# Use: https://www.whatsmydns.net/#CNAME/mcp.instantly.ai
```

### **SSL Certificate Monitoring**

**Tools:**
- SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=mcp.instantly.ai
- Certificate Transparency: https://crt.sh/?q=mcp.instantly.ai

**Expected Results:**
- Grade: A or A+
- Protocol: TLS 1.2, TLS 1.3
- Certificate: Let's Encrypt
- Expiry: 90 days from issuance

### **Uptime Monitoring**

**Recommended Tools:**
- UptimeRobot: https://uptimerobot.com
- Pingdom: https://www.pingdom.com
- StatusCake: https://www.statuscake.com

**Monitor:**
- `https://mcp.instantly.ai/health` (every 5 minutes)
- Alert on: Response time > 5s, Status code != 200

---

## 🚨 **Troubleshooting**

### **Issue 1: DNS Not Resolving**

**Symptoms:**
```bash
dig mcp.instantly.ai
# Returns NXDOMAIN or no records
```

**Solutions:**
1. Verify CNAME record is correct in DNS provider
2. Check for typos in hostname or target
3. Wait for DNS propagation (up to 48 hours)
4. Clear local DNS cache:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

---

### **Issue 2: SSL Certificate Not Provisioning**

**Symptoms:**
- DigitalOcean shows "Certificate Pending"
- HTTPS not working after 30+ minutes

**Solutions:**
1. Verify DNS CNAME is pointing correctly
2. Check domain ownership verification in DigitalOcean
3. Remove and re-add the domain in DigitalOcean
4. Contact DigitalOcean support if issue persists

---

### **Issue 3: Mixed Content Warnings**

**Symptoms:**
- Browser shows "Not Secure" warning
- Some resources loading over HTTP

**Solutions:**
1. Ensure all resources use HTTPS
2. Check for hardcoded HTTP URLs in code
3. Enable HSTS (HTTP Strict Transport Security):
   ```javascript
   // In src/index.ts
   app.use((req, res, next) => {
     res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
     next();
   });
   ```

---

### **Issue 4: Old URL Still Being Used**

**Symptoms:**
- Users reporting old URL in error messages
- Analytics showing traffic to old URL

**Solutions:**
1. Send migration announcement to all users
2. Update all documentation with new URL
3. Add redirect from old URL to new URL (optional):
   ```javascript
   // In src/index.ts
   app.use((req, res, next) => {
     if (req.hostname.includes('ondigitalocean.app')) {
       return res.redirect(301, `https://mcp.instantly.ai${req.path}`);
     }
     next();
   });
   ```

---

## ✅ **Verification Checklist**

### **DNS Configuration:**
- [ ] CNAME record created: `mcp.instantly.ai` → `instantly-mcp-production.ondigitalocean.app`
- [ ] DNS propagation complete (verified with `dig`)
- [ ] DNS resolves from multiple locations

### **DigitalOcean Configuration:**
- [ ] Custom domain added to app
- [ ] Domain ownership verified
- [ ] SSL certificate provisioned and active
- [ ] Domain set as primary (optional)

### **SSL/TLS:**
- [ ] HTTPS working: `https://mcp.instantly.ai/health`
- [ ] HTTP redirects to HTTPS
- [ ] SSL certificate valid (Let's Encrypt)
- [ ] SSL Labs grade: A or A+

### **Application:**
- [ ] Health check endpoint working: `/health`
- [ ] MCP endpoint working: `/mcp`
- [ ] Authentication working (URL-based and header-based)
- [ ] Multi-step campaigns working

### **Client Updates:**
- [ ] Claude Desktop configuration updated
- [ ] n8n configuration updated
- [ ] MCP Inspector configuration updated
- [ ] Documentation updated with new URL

### **Monitoring:**
- [ ] Uptime monitoring configured
- [ ] SSL certificate expiry monitoring
- [ ] DNS monitoring (optional)

---

## 📝 **Post-Configuration Tasks**

1. **Update README.md**
   - Replace all references to old URL with `https://mcp.instantly.ai/mcp`

2. **Update Documentation**
   - Update all guides and examples with new URL

3. **Announce Migration**
   - Send email to all users
   - Post announcement in Slack/Discord
   - Update website/landing page

4. **Monitor Traffic**
   - Track migration progress
   - Monitor for errors or issues
   - Gather user feedback

---

## 🔗 **Related Resources**

- **DigitalOcean Custom Domains:** https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/
- **Let's Encrypt:** https://letsencrypt.org/
- **Cloudflare DNS:** https://www.cloudflare.com/dns/
- **SSL Labs:** https://www.ssllabs.com/ssltest/

---

**Last Updated:** 2025-09-30  
**Version:** 1.0  
**Status:** Ready for Implementation

