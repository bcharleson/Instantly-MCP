# 🛡️ Comprehensive Rollback Strategy for Zod Integration

## 🎯 Overview

This document provides complete rollback procedures for safely testing and deploying the Zod validation integration while maintaining the ability to quickly revert to known-working states.

## 1. 📋 Git-Based Rollback Options

### **Current State Protection**
```bash
# 1. Create a backup tag of the current working main branch
git checkout main
git tag -a v1.0.6-stable-backup -m "Stable backup before Zod integration"
git push origin v1.0.6-stable-backup

# 2. Create a backup branch of current main
git checkout main
git checkout -b backup/pre-zod-stable
git push origin backup/pre-zod-stable
```

### **Safe Merge Strategy**
```bash
# 1. Merge Zod integration to main safely
git checkout main
git merge feature/zod-validation-integration --no-ff -m "feat: Integrate Zod validation with rollback safety"

# 2. Create post-merge tag for easy reference
git tag -a v1.0.7-zod-integration -m "Zod integration version"
git push origin v1.0.7-zod-integration
git push origin main
```

### **Rollback Procedures**

#### **Scenario A: Rollback before merging to main**
```bash
# Simply switch back to main branch
git checkout main
# The feature branch remains intact for future fixes
```

#### **Scenario B: Rollback after merging to main**
```bash
# Option 1: Revert the merge commit (safest)
git checkout main
git revert -m 1 <merge-commit-hash> -m "Revert Zod integration due to compatibility issues"
git push origin main

# Option 2: Reset to backup tag (more aggressive)
git checkout main
git reset --hard v1.0.6-stable-backup
git push origin main --force-with-lease
```

#### **Scenario C: Emergency rollback**
```bash
# Immediately switch to backup branch
git checkout backup/pre-zod-stable
git checkout -b hotfix/emergency-rollback
# Make any necessary fixes
git push origin hotfix/emergency-rollback
```

## 2. 🚀 NPM Deployment Safety Measures

### **Beta Version Publishing Strategy**
```bash
# 1. Update version for beta testing
npm version prerelease --preid=beta
# This creates: 1.0.6-beta.2, 1.0.6-beta.3, etc.

# 2. Publish to beta tag (doesn't affect latest)
npm publish --tag beta

# 3. Test installation with beta tag
npx instantly-mcp@beta --api-key YOUR_KEY
```

### **Alpha Version for Early Testing**
```bash
# For very early testing
npm version prerelease --preid=alpha
npm publish --tag alpha

# Test with alpha version
npx instantly-mcp@alpha --api-key YOUR_KEY
```

### **NPM Tag Management**
```bash
# View all published versions and tags
npm view instantly-mcp versions --json
npm view instantly-mcp dist-tags

# Move tags if needed
npm dist-tag add instantly-mcp@1.0.6 latest  # Rollback latest tag
npm dist-tag add instantly-mcp@1.0.7-beta.1 beta

# Remove problematic version (use sparingly)
npm unpublish instantly-mcp@1.0.7-beta.1 --force
```

### **Version Numbering Strategy**
```
Current stable: 1.0.6
├── Alpha testing: 1.0.7-alpha.1, 1.0.7-alpha.2
├── Beta testing: 1.0.7-beta.1, 1.0.7-beta.2
├── Release candidate: 1.0.7-rc.1
└── Stable release: 1.0.7
```

## 3. 🧪 Testing Workflow Recommendations

### **Phase 1: Local Testing**
```bash
# 1. Build and test locally
npm run build
node dist/index.js --api-key YOUR_KEY

# 2. Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js -- --api-key YOUR_KEY

# 3. Local Cursor integration test (see setup below)
```

### **Phase 2: Alpha NPM Testing**
```bash
# 1. Publish alpha version
npm version prerelease --preid=alpha
npm publish --tag alpha

# 2. Test in controlled environments
# - Local Cursor setup with alpha version
# - Isolated Claude Desktop config

# 3. Rollback if issues found
npm dist-tag add instantly-mcp@1.0.6 latest
```

### **Phase 3: Beta NPM Testing**
```bash
# 1. Publish beta version
npm version prerelease --preid=beta
npm publish --tag beta

# 2. Broader testing
# - Multiple environment testing
# - Community beta testing

# 3. Monitor for issues
```

### **Phase 4: Production Release**
```bash
# 1. Final version bump
npm version minor  # 1.0.6 -> 1.0.7

# 2. Publish to latest
npm publish

# 3. Update documentation
```

## 4. 🔒 Risk Mitigation Strategies

### **Code Safety**
- ✅ Feature branch preserved until stable
- ✅ Backup tags created before any changes
- ✅ Backup branches for emergency rollback
- ✅ All changes are reversible

### **NPM Safety**
- ✅ Beta/alpha tags prevent affecting stable users
- ✅ Version numbering allows easy identification
- ✅ Unpublish capability for emergency situations
- ✅ Tag management for controlled rollouts

### **Testing Safety**
- ✅ Local testing before any publishing
- ✅ Isolated environment testing
- ✅ Gradual rollout strategy
- ✅ Quick rollback procedures documented

## 5. 🚨 Emergency Procedures

### **Immediate Rollback Commands**
```bash
# Git rollback
git checkout backup/pre-zod-stable

# NPM rollback
npm dist-tag add instantly-mcp@1.0.6 latest

# Local testing rollback
git checkout main
npm run build
```

### **Communication Plan**
1. Document any issues found
2. Notify users of rollback via GitHub releases
3. Update README with known issues
4. Plan fixes for next iteration

## 6. 📊 Rollback Decision Matrix

| Issue Severity | Action | Timeline |
|---------------|--------|----------|
| Critical bugs | Immediate NPM tag rollback | < 1 hour |
| Compatibility issues | Beta tag removal, fix in feature branch | < 24 hours |
| Performance issues | Investigate, potential rollback | < 48 hours |
| Minor issues | Fix in next patch version | Next release cycle |

This strategy ensures we can test thoroughly while maintaining complete safety and rollback capabilities at every stage.
