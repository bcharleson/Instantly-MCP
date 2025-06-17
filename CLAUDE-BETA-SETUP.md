# Claude Desktop Beta Setup Guide

## 🚀 **Beta Version Published Successfully**

**Version**: `instantly-mcp@1.0.6-beta.1`  
**NPM Tag**: `beta`  
**Status**: ✅ Published and ready for testing

## 🔧 **Claude Desktop Configuration**

### **Option 1: Secure Environment Variable Method (Recommended)**

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "instantly": {
      "command": "npx",
      "args": ["instantly-mcp@beta"],
      "env": {
        "INSTANTLY_API_KEY": "your-instantly-api-key-here"
      }
    }
  }
}
```

### **Option 2: Command-Line Argument Method (Less Secure)**

```json
{
  "mcpServers": {
    "instantly": {
      "command": "npx",
      "args": ["instantly-mcp@beta", "--api-key", "your-instantly-api-key-here"]
    }
  }
}
```

## 🎯 **Key Configuration Details**

### **Package Specification**
- **Use**: `instantly-mcp@beta` (not `instantly-mcp@latest`)
- **Why**: This ensures you get the beta version with all the latest improvements
- **Version**: Will automatically use `1.0.6-beta.1` (the latest beta)

### **API Key Security**
- **Recommended**: Use the `env` section for API keys
- **Benefit**: API keys not visible in process lists
- **Alternative**: Command-line args work but are less secure

## 📋 **Complete Setup Steps**

### **1. Get Your API Key**
1. Go to [Instantly Dashboard](https://app.instantly.ai/app/settings/integrations)
2. Generate a new API key (if you don't have one)
3. Copy the API key

### **2. Update Claude Configuration**
1. Open Claude Desktop
2. Go to Settings → Developer → Edit Config
3. Add or update the `instantly` server configuration
4. Use the secure environment variable method above

### **3. Restart Claude Desktop**
- Close Claude Desktop completely
- Reopen Claude Desktop
- The new MCP server will be loaded automatically

### **4. Verify Installation**
In Claude, try these commands to test:

```
List my Instantly accounts
```

```
Create a campaign with these details:
- Name: "Beta Test Campaign"
- Subject: "Testing new features"
- Body: "Hi {{firstName}}, this is a test of the new multi-step campaign features."
- Email list: ["your-verified-email@domain.com"]
- Sequence steps: 3
```

## 🆕 **New Features in Beta Version**

### **Multi-Step Campaign Improvements**
- ✅ `sequence_bodies` - Custom body content for each step
- ✅ `sequence_subjects` - Custom subject lines for each step
- ✅ `continue_thread` - Automatic blank follow-up subjects

### **Security Enhancements**
- ✅ Secure API key handling via environment variables
- ✅ No hard-coded credentials in codebase
- ✅ Clear security warnings for insecure usage

### **Build Safety**
- ✅ Automatic build before publish
- ✅ Fresh artifacts guaranteed
- ✅ No stale code published

## 🧪 **Testing the New Features**

### **Test 1: Basic Backward Compatibility**
```
Create a campaign:
- Name: "Compatibility Test"
- Subject: "Hello {{firstName}}"
- Body: "Hi {{firstName}}, this is a test."
- Email list: ["your-email@domain.com"]
- Sequence steps: 3
```
**Expected**: Should work exactly as before with "Follow-up 1:", "Follow-up 2:" prefixes.

### **Test 2: Custom Sequence Bodies**
```
Create a campaign:
- Name: "Custom Bodies Test"
- Subject: "Quick question"
- Body: "Will be overridden"
- Email list: ["your-email@domain.com"]
- Sequence steps: 3
- Sequence bodies: [
  "Hi {{firstName}}, I noticed {{companyName}}...",
  "Hey {{firstName}}, just following up...",
  "Hi {{firstName}}, final follow-up..."
]
```
**Expected**: Each step should use the corresponding custom body.

### **Test 3: Thread Continuation**
```
Create a campaign:
- Name: "Thread Test"
- Subject: "Quick question about {{companyName}}"
- Body: "Initial email content"
- Email list: ["your-email@domain.com"]
- Sequence steps: 3
- Continue thread: true
```
**Expected**: First email has subject, follow-ups have blank subjects.

## 🔍 **Troubleshooting**

### **If MCP Server Doesn't Load**
1. Check Claude Desktop logs
2. Verify API key is correct
3. Ensure `npx` can access `instantly-mcp@beta`
4. Try restarting Claude Desktop

### **If API Key Issues**
1. Verify API key in Instantly dashboard
2. Check environment variable is set correctly
3. Try the command-line argument method as fallback

### **If Commands Don't Work**
1. Verify the beta version is loaded: `npm list -g instantly-mcp`
2. Check if tools are available: Ask Claude "What Instantly tools are available?"
3. Test with basic commands first: "List my accounts"

## 📊 **Version Information**

- **Current Beta**: `1.0.6-beta.1`
- **Previous Stable**: `1.0.5`
- **Installation**: `npx instantly-mcp@beta`
- **NPM Page**: https://www.npmjs.com/package/instantly-mcp/v/1.0.6-beta.1

## 🎉 **Ready for Testing!**

The beta version is now live and ready for testing in Claude Desktop. All new features maintain 100% backward compatibility while adding powerful new capabilities for multi-step email campaigns.

**Happy testing!** 🚀
