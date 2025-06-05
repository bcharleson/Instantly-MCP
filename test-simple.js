#!/usr/bin/env node

/**
 * Simple deployment verification for Instantly MCP v4.0.0
 */

import { spawn } from 'child_process';

console.log('🧪 Simple Deployment Test for Instantly MCP v4.0.0\n');

// Test the tools list without API key requirement
function testToolsList() {
  return new Promise((resolve) => {
    console.log('🔍 Testing tools list...');
    
    const echo = spawn('echo', ['{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}']);
    const mcp = spawn('node', ['dist/index.js', '--api-key', 'test-key']);
    
    echo.stdout.pipe(mcp.stdin);
    
    let output = '';
    let errorOutput = '';
    
    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    mcp.on('close', (code) => {
      const fullOutput = output + errorOutput;
      
      // Check for key indicators
      const hasCreateCampaign = fullOutput.includes('create_campaign');
      const hasAutoDiscovery = fullOutput.includes('Auto-Discovery') || fullOutput.includes('auto-discovery');
      const hasGuidedMode = fullOutput.includes('guided_mode');
      const noWizard = !fullOutput.includes('campaign_creation_wizard');
      const hasEnhancedDescription = fullOutput.includes('MANDATORY PREREQUISITE') || fullOutput.includes('complete pagination');
      
      console.log(`   ✅ create_campaign tool: ${hasCreateCampaign ? 'FOUND' : 'MISSING'}`);
      console.log(`   ✅ Auto-discovery feature: ${hasAutoDiscovery ? 'FOUND' : 'MISSING'}`);
      console.log(`   ✅ Guided mode parameter: ${hasGuidedMode ? 'FOUND' : 'MISSING'}`);
      console.log(`   ✅ Wizard removal: ${noWizard ? 'CONFIRMED' : 'STILL PRESENT'}`);
      console.log(`   ✅ Enhanced descriptions: ${hasEnhancedDescription ? 'FOUND' : 'MISSING'}`);
      
      const score = [hasCreateCampaign, hasAutoDiscovery, hasGuidedMode, noWizard, hasEnhancedDescription].filter(Boolean).length;
      
      resolve({
        success: score >= 4,
        score: score,
        total: 5,
        details: {
          hasCreateCampaign,
          hasAutoDiscovery,
          hasGuidedMode,
          noWizard,
          hasEnhancedDescription
        }
      });
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      mcp.kill();
      echo.kill();
      resolve({
        success: false,
        score: 0,
        total: 5,
        error: 'TIMEOUT'
      });
    }, 10000);
  });
}

// Test package.json version
async function testPackageVersion() {
  console.log('\n🔍 Testing package version...');

  try {
    const fs = await import('fs');
    const packageJson = JSON.parse(fs.default.readFileSync('package.json', 'utf8'));
    const version = packageJson.version;

    console.log(`   📦 Package version: ${version}`);

    const isCorrectVersion = version === '4.0.0';
    console.log(`   ✅ Version check: ${isCorrectVersion ? 'PASS' : 'FAIL'}`);

    return {
      success: isCorrectVersion,
      version: version
    };
  } catch (error) {
    console.log(`   ❌ Error reading package.json: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Test dist files exist
async function testDistFiles() {
  console.log('\n🔍 Testing build files...');

  try {
    const fs = await import('fs');
    const files = ['dist/index.js', 'dist/index.d.ts'];
    const results = {};

    for (const file of files) {
      const exists = fs.default.existsSync(file);
      console.log(`   📁 ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
      results[file] = exists;
    }

    const allExist = Object.values(results).every(Boolean);

    return {
      success: allExist,
      files: results
    };
  } catch (error) {
    console.log(`   ❌ Error checking files: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting simple deployment tests...\n');
  
  const packageTest = await testPackageVersion();
  const distTest = await testDistFiles();
  const toolsTest = await testToolsList();
  
  // Summary
  const tests = [packageTest, distTest, toolsTest];
  const passed = tests.filter(t => t.success).length;
  const total = tests.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   Tests Passed: ${passed}/${total} (${percentage}%)`);
  
  if (percentage >= 80) {
    console.log('   🎉 DEPLOYMENT SUCCESS: v4.0.0 ready for testing!');
  } else if (percentage >= 60) {
    console.log('   ⚠️  DEPLOYMENT WARNING: Some issues detected');
  } else {
    console.log('   ❌ DEPLOYMENT FAILURE: Critical issues found');
  }
  
  console.log('\n🎯 Key Features Verified:');
  if (toolsTest.details) {
    console.log(`   🤖 Auto-discovery: ${toolsTest.details.hasAutoDiscovery ? '✅' : '❌'}`);
    console.log(`   🎓 Guided mode: ${toolsTest.details.hasGuidedMode ? '✅' : '❌'}`);
    console.log(`   ❌ Wizard removal: ${toolsTest.details.noWizard ? '✅' : '❌'}`);
    console.log(`   📖 Enhanced descriptions: ${toolsTest.details.hasEnhancedDescription ? '✅' : '❌'}`);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('   1. 🧪 Run comprehensive tests with real API key');
  console.log('   2. 📖 Follow TESTING_GUIDE_v4.0.0.md for detailed testing');
  console.log('   3. 🚀 Test auto-discovery and guided mode features');
  console.log('   4. ✅ Verify wizard removal and enhanced error messages');
  
  console.log('\n🎯 Ready for Production Testing!');
  console.log('   📦 Package: instantly-mcp@4.0.0');
  console.log('   🔗 GitHub: https://github.com/bcharleson/Instantly-MCP');
  console.log('   📚 Docs: RELEASE_NOTES_v4.0.0.md');
  
  return percentage >= 80;
}

// Run the tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
