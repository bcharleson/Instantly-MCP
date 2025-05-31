#!/usr/bin/env node
/**
 * Quick Tool Validation Script
 * Validates tool definitions and identifies structural issues
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

interface ValidationResult {
  tool: string;
  issues: string[];
  status: 'VALID' | 'WARNING' | 'ERROR';
}

function extractToolsFromSource(): ToolDefinition[] {
  const indexPath = join(process.cwd(), 'src', 'index.ts');
  const content = readFileSync(indexPath, 'utf-8');
  
  // Extract tools array from the setRequestHandler
  const toolsMatch = content.match(/tools:\s*\[([\s\S]*?)\]/);
  if (!toolsMatch) {
    throw new Error('Could not find tools array in source code');
  }
  
  // Count tools by looking for tool objects within the tools array only
  const toolsSection = toolsMatch[1];
  const toolMatches = toolsSection.matchAll(/{\s*name:\s*['"](.*?)['"],/g);
  const tools: ToolDefinition[] = [];
  
  for (const match of toolMatches) {
    const toolName = match[1];
    
    // Extract description for this tool
    const descRegex = new RegExp(`name:\\s*['"]${toolName}['"],\\s*description:\\s*['"]([\\s\\S]*?)['"],`);
    const descMatch = content.match(descRegex);
    
    tools.push({
      name: toolName,
      description: descMatch ? descMatch[1] : 'No description found',
      inputSchema: {} // We'll do basic validation
    });
  }
  
  return tools;
}

function extractImplementedCases(): string[] {
  const indexPath = join(process.cwd(), 'src', 'index.ts');
  const content = readFileSync(indexPath, 'utf-8');
  
  // Extract case statements from switch block
  const caseMatches = content.matchAll(/case\s+['"](.*?)['"]:/g);
  const cases: string[] = [];
  
  for (const match of caseMatches) {
    cases.push(match[1]);
  }
  
  return cases;
}

function validateTools(): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  try {
    const definedTools = extractToolsFromSource();
    const implementedCases = extractImplementedCases();
    
    console.log(`📊 Found ${definedTools.length} tool definitions`);
    console.log(`📊 Found ${implementedCases.length} case implementations`);
    
    // Check each defined tool
    for (const tool of definedTools) {
      const issues: string[] = [];
      
      // Check if tool has implementation
      if (!implementedCases.includes(tool.name)) {
        issues.push('No implementation found in switch statement');
      }
      
      // Check for tool name conflicts
      const duplicates = definedTools.filter(t => t.name === tool.name);
      if (duplicates.length > 1) {
        issues.push(`Duplicate tool definition (${duplicates.length} instances)`);
      }
      
      // Check description quality
      if (tool.description.length < 20) {
        issues.push('Description too short (should be more descriptive)');
      }
      
      // Check for prerequisite documentation
      if (tool.name === 'create_campaign' && !tool.description.includes('list_accounts')) {
        issues.push('Missing prerequisite documentation for list_accounts');
      }
      
      results.push({
        tool: tool.name,
        issues,
        status: issues.length === 0 ? 'VALID' : 
                issues.some(i => i.includes('No implementation') || i.includes('Duplicate')) ? 'ERROR' : 'WARNING'
      });
    }
    
    // Check for orphaned implementations
    for (const caseName of implementedCases) {
      if (!definedTools.some(t => t.name === caseName)) {
        results.push({
          tool: caseName,
          issues: ['Implementation without tool definition (orphaned code)'],
          status: 'ERROR'
        });
      }
    }
    
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
  
  return results;
}

function printReport(results: ValidationResult[]): void {
  console.log('\n🔍 TOOL VALIDATION REPORT');
  console.log('=' .repeat(60));
  
  const valid = results.filter(r => r.status === 'VALID').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`📊 Summary: ${valid} valid, ${warnings} warnings, ${errors} errors\n`);
  
  // Group by status
  const statusOrder = ['ERROR', 'WARNING', 'VALID'] as const;
  
  for (const status of statusOrder) {
    const filtered = results.filter(r => r.status === status);
    if (filtered.length === 0) continue;
    
    const icon = status === 'VALID' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} ${status} (${filtered.length}):`);
    
    for (const result of filtered) {
      console.log(`  • ${result.tool}`);
      for (const issue of result.issues) {
        console.log(`    └─ ${issue}`);
      }
    }
    console.log();
  }
  
  // Recommendations
  if (errors > 0 || warnings > 0) {
    console.log('🔧 RECOMMENDATIONS:');
    
    if (results.some(r => r.issues.includes('Duplicate tool definition'))) {
      console.log('  • Remove duplicate tool definitions');
    }
    
    if (results.some(r => r.issues.includes('Implementation without tool definition'))) {
      console.log('  • Remove orphaned implementations or add tool definitions');
    }
    
    if (results.some(r => r.issues.includes('No implementation found'))) {
      console.log('  • Add implementations for defined tools');
    }
    
    if (results.some(r => r.issues.includes('Missing prerequisite documentation'))) {
      console.log('  • Document tool dependencies in descriptions');
    }
    
    console.log();
  }
}

function main(): void {
  console.log('🚀 INSTANTLY MCP TOOL VALIDATOR');
  console.log('Checking tool definitions and implementations...\n');
  
  const results = validateTools();
  printReport(results);
  
  const hasErrors = results.some(r => r.status === 'ERROR');
  
  if (hasErrors) {
    console.log('❌ Validation failed with errors. Please fix before proceeding.');
    process.exit(1);
  } else {
    console.log('✅ Validation completed successfully!');
  }
}

// ES module entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateTools, ValidationResult };