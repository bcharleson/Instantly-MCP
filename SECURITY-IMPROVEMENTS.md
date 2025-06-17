# Security Improvements - API Key Handling

## 🔐 Security Issue Fixed

**Problem**: The previous implementation passed API keys as command-line arguments, which exposed them in the process list on multi-user systems. This created a security vulnerability where other users could potentially see API keys by running `ps aux` or similar commands.

**Solution**: Implemented secure API key handling that prioritizes environment variables and provides secure input methods.

## ✅ **Improvements Made**

### 1. **Environment Variable Priority**
- **Primary Method**: `INSTANTLY_API_KEY` environment variable
- **Secure**: Not visible in process lists
- **Recommended**: Best practice for API key management

```bash
# Secure method (recommended)
export INSTANTLY_API_KEY="your-api-key-here"
./check-accounts.sh
```

### 2. **Secure Interactive Input**
- **Fallback**: Prompts user for secure input if no environment variable is set
- **Hidden Input**: Uses `stty -echo` to hide API key during typing
- **Cross-platform**: Fallback for systems without `stty`

```bash
# Interactive secure input
./check-accounts.sh
# Prompts: "Enter API key (input will be hidden): "
```

### 3. **Backward Compatibility**
- **Legacy Support**: Still accepts `--api-key` command-line argument
- **Security Warning**: Shows warning when using insecure method
- **Migration Path**: Encourages users to switch to environment variable

```bash
# Legacy method (shows security warning)
./check-accounts.sh YOUR_API_KEY
```

## 🛡️ **Security Benefits**

### Before (Insecure)
```bash
# API key visible in process list
ps aux | grep instantly-mcp
# Output: node dist/index.js --api-key sk-1234567890abcdef...
```

### After (Secure)
```bash
# API key NOT visible in process list
ps aux | grep instantly-mcp
# Output: node dist/index.js
```

## 📋 **Implementation Details**

### Files Modified

1. **`src/index.ts`** - Updated API key handling logic
   - Checks `process.env.INSTANTLY_API_KEY` first
   - Falls back to command-line argument for compatibility
   - Provides clear error messages with security guidance

2. **`check-accounts.sh`** - Enhanced security features
   - Environment variable detection
   - Secure interactive input with hidden typing
   - Security warnings for insecure usage
   - Updated documentation

### Code Changes

**API Key Resolution Priority:**
1. `INSTANTLY_API_KEY` environment variable (secure)
2. `--api-key` command-line argument (insecure, with warning)
3. Interactive secure input (hidden typing)
4. Error with security guidance

**Security Features:**
- Hidden input using `stty -echo`
- Process list protection
- Clear security warnings
- Migration guidance

## 🧪 **Testing Verification**

Created `test-secure-api-key.sh` to verify:
- ✅ Environment variable method works
- ✅ Command-line argument method works (with warning)
- ✅ No API key properly rejected
- ✅ Security warnings displayed

## 📖 **Usage Examples**

### Recommended Secure Usage
```bash
# Set environment variable (secure)
export INSTANTLY_API_KEY="your-api-key-here"

# Use check-accounts script
./check-accounts.sh

# Use MCP server directly
npx instantly-mcp@latest
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "instantly": {
      "command": "npx",
      "args": ["instantly-mcp@latest"],
      "env": {
        "INSTANTLY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Interactive Secure Input
```bash
# No environment variable set
./check-accounts.sh

# Output:
# 🔐 Please provide your Instantly API key
# Choose one of these secure methods:
# 1. Set environment variable: export INSTANTLY_API_KEY='your-key-here'
# 2. Enter it securely when prompted below
# 
# Enter API key (input will be hidden): [user types securely]
```

## 🎯 **Security Best Practices**

1. **Always use environment variables** for API keys
2. **Never commit API keys** to version control
3. **Use secure input methods** when interactive input is needed
4. **Avoid command-line arguments** for sensitive data
5. **Monitor process lists** on shared systems

## 🔄 **Migration Guide**

### For Existing Users
1. **Set environment variable**: `export INSTANTLY_API_KEY="your-key"`
2. **Update scripts**: Remove API key from command-line arguments
3. **Update Claude config**: Use `env` section instead of `args`

### For New Users
1. **Start with environment variable**: Most secure approach
2. **Use interactive input**: If environment variable not set
3. **Avoid command-line arguments**: Unless absolutely necessary

---

## 🎉 **Result**

The Instantly MCP server now follows security best practices for API key handling:
- ✅ **Secure by default** - Environment variables prioritized
- ✅ **Process list protection** - API keys not visible to other users
- ✅ **Backward compatible** - Existing usage still works (with warnings)
- ✅ **User-friendly** - Clear guidance and secure alternatives
- ✅ **Cross-platform** - Works on all Unix-like systems

This improvement significantly enhances the security posture of the MCP server while maintaining ease of use and backward compatibility.
