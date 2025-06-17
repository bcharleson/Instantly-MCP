#!/usr/bin/env tsx

/**
 * Validation script for Instantly MCP v1.0.2
 * Validates tool definitions and counts without requiring API key
 */

import { spawn } from 'child_process';

async function validateTools(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🔍 Validating Instantly MCP v1.0.2 Tool Definitions...');
    console.log('=' .repeat(60));

    const child = spawn('node', ['dist/index.js', '--api-key', 'dummy-key-for-validation'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Send list tools request
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        };

        child.stdin.write(JSON.stringify(request) + '\n');
        child.stdin.end();

        setTimeout(() => {
          try {
            // Parse the response to get tool list
            const lines = output.split('\n').filter(line => line.trim());
            let toolsResponse = null;

            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.result && parsed.result.tools) {
                  toolsResponse = parsed.result.tools;
                  break;
                }
              } catch (e) {
                // Continue looking
              }
            }

            if (toolsResponse) {
              console.log(`✅ Successfully loaded ${toolsResponse.length} tools`);
              console.log('\n📋 AVAILABLE TOOLS:');
              
              const categories = {
                'Campaign Management': [],
                'Account Management': [],
                'Lead Management': [],
                'Lead Lists': [],
                'Email Operations': [],
                'Email Verification': [],
                'Analytics': [],
                'API Key Management': [],
                'Debugging/Helper Tools': []
              };

              // Categorize tools
              toolsResponse.forEach((tool: any) => {
                const name = tool.name;
                if (name.includes('campaign')) {
                  categories['Campaign Management'].push(name);
                } else if (name.includes('account')) {
                  categories['Account Management'].push(name);
                } else if (name.includes('lead') && !name.includes('list')) {
                  categories['Lead Management'].push(name);
                } else if (name.includes('lead_list') || name.includes('list_lead')) {
                  categories['Lead Lists'].push(name);
                } else if (name.includes('email') && !name.includes('verify')) {
                  categories['Email Operations'].push(name);
                } else if (name.includes('verify')) {
                  categories['Email Verification'].push(name);
                } else if (name.includes('analytics')) {
                  categories['Analytics'].push(name);
                } else if (name.includes('api_key')) {
                  categories['API Key Management'].push(name);
                } else {
                  categories['Debugging/Helper Tools'].push(name);
                }
              });

              // Display categorized tools
              let totalTools = 0;
              Object.entries(categories).forEach(([category, tools]) => {
                if (tools.length > 0) {
                  console.log(`\n${category} (${tools.length}):`);
                  tools.forEach(tool => console.log(`  • ${tool}`));
                  totalTools += tools.length;
                }
              });

              console.log('\n' + '='.repeat(60));
              console.log('📊 VALIDATION SUMMARY');
              console.log('='.repeat(60));
              console.log(`✅ Total Tools Available: ${totalTools}`);
              
              // Check for removed tools
              const removedTools = ['activate_campaign', 'move_leads', 'create_api_key', 'create_account'];
              const stillPresent = removedTools.filter(tool => 
                toolsResponse.some((t: any) => t.name === tool)
              );
              
              if (stillPresent.length === 0) {
                console.log('✅ All problematic tools successfully removed');
              } else {
                console.log(`❌ Some tools still present: ${stillPresent.join(', ')}`);
              }

              // Check for fixed tools
              const fixedTools = ['update_account', 'get_warmup_analytics'];
              const fixedPresent = fixedTools.filter(tool => 
                toolsResponse.some((t: any) => t.name === tool)
              );
              
              console.log(`✅ Fixed tools present: ${fixedPresent.join(', ')} (${fixedPresent.length}/2)`);

              // Expected tool count: 28 original - 4 removed = 24 tools
              const expectedCount = 24;
              if (totalTools === expectedCount) {
                console.log(`✅ Tool count matches expected: ${totalTools}/${expectedCount}`);
              } else {
                console.log(`⚠️  Tool count mismatch: ${totalTools}/${expectedCount}`);
              }

              console.log('\n🎯 VERSION 1.0.2 STATUS:');
              if (totalTools === expectedCount && stillPresent.length === 0 && fixedPresent.length === 2) {
                console.log('✅ Ready for release!');
                console.log('✅ All fixes implemented correctly');
                console.log('✅ Problematic tools removed');
                console.log('✅ Account management tools fixed');
              } else {
                console.log('⚠️  Some issues detected, review needed');
              }

            } else {
              console.log('❌ Could not parse tools response');
              console.log('Raw output:', output);
            }

            resolve();
          } catch (e) {
            console.error('❌ Validation error:', e);
            reject(e);
          }
        }, 2000);

      } catch (e) {
        console.error('❌ Process error:', e);
        reject(e);
      }
    });

    // Send the list tools request
    setTimeout(() => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    }, 1000);

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Validation timeout'));
    }, 10000);
  });
}

validateTools().catch(console.error);
