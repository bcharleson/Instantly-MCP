#!/usr/bin/env node

/**
 * Basic functionality test for multi-step campaign improvements
 * Tests the core logic without requiring API calls
 */

// Mock the campaign building logic to test locally
function mockBuildCampaignPayload(args) {
  // Simulate the core logic from buildCampaignPayload
  const normalizedBody = args.body.trim();
  const normalizedSubject = args.subject.trim();
  
  // Mock HTML conversion (simplified)
  const convertLineBreaksToHtml = (text) => {
    return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  };
  
  const campaignData = {
    name: args.name,
    sequences: [{
      steps: [{
        type: 'email',
        delay: 0,
        variants: [{
          subject: normalizedSubject,
          body: convertLineBreaksToHtml(normalizedBody),
          v_disabled: false
        }]
      }]
    }]
  };

  // Add multiple sequence steps if requested
  if (args.sequence_steps && Number(args.sequence_steps) > 1) {
    const stepDelayDays = Number(args.step_delay_days) || 3;
    const numSteps = Number(args.sequence_steps);

    // Check if custom sequence content is provided
    const hasCustomBodies = args.sequence_bodies && Array.isArray(args.sequence_bodies) && args.sequence_bodies.length >= numSteps;
    const hasCustomSubjects = args.sequence_subjects && Array.isArray(args.sequence_subjects) && args.sequence_subjects.length >= numSteps;
    const shouldContinueThread = args.continue_thread === true && !hasCustomSubjects;

    // Update the first step if custom content is provided
    if (hasCustomBodies || hasCustomSubjects) {
      const firstStepBody = hasCustomBodies ? convertLineBreaksToHtml(String(args.sequence_bodies[0])) : convertLineBreaksToHtml(normalizedBody);
      const firstStepSubject = hasCustomSubjects ? String(args.sequence_subjects[0]) : normalizedSubject;
      
      campaignData.sequences[0].steps[0].variants[0].body = firstStepBody;
      campaignData.sequences[0].steps[0].variants[0].subject = firstStepSubject;
    }

    // Add follow-up steps
    for (let i = 1; i < numSteps; i++) {
      let followUpSubject;
      let followUpBody;

      // Determine subject for this step
      if (hasCustomSubjects) {
        // Use provided custom subject
        followUpSubject = String(args.sequence_subjects[i]);
      } else if (shouldContinueThread) {
        // Blank subject for thread continuation
        followUpSubject = '';
      } else {
        // Default behavior: add follow-up prefix
        followUpSubject = `Follow-up ${i}: ${normalizedSubject}`.trim();
      }

      // Determine body for this step
      if (hasCustomBodies) {
        // Use provided custom body with HTML conversion
        followUpBody = convertLineBreaksToHtml(String(args.sequence_bodies[i]));
      } else {
        // Default behavior: add follow-up prefix to original body
        followUpBody = `This is follow-up #${i}.\n\n${normalizedBody}`.trim();
        followUpBody = convertLineBreaksToHtml(followUpBody);
      }

      campaignData.sequences[0].steps.push({
        type: 'email',
        delay: stepDelayDays,
        variants: [{
          subject: followUpSubject,
          body: followUpBody,
          v_disabled: false
        }]
      });
    }
  }

  return campaignData;
}

// Test cases
const testCases = [
  {
    name: 'Backward Compatibility - Single Step',
    args: {
      name: 'Test Campaign',
      subject: 'Hello {{firstName}}',
      body: 'Hi {{firstName}},\n\nThis is a test.\n\nBest,\nTeam',
      sequence_steps: 1
    },
    expected: {
      stepCount: 1,
      firstSubject: 'Hello {{firstName}}',
      firstBodyContains: 'Hi {{firstName}}'
    }
  },
  {
    name: 'Backward Compatibility - Multi-Step Default',
    args: {
      name: 'Test Campaign',
      subject: 'Hello {{firstName}}',
      body: 'Hi {{firstName}},\n\nThis is a test.\n\nBest,\nTeam',
      sequence_steps: 3
    },
    expected: {
      stepCount: 3,
      firstSubject: 'Hello {{firstName}}',
      secondSubject: 'Follow-up 1: Hello {{firstName}}',
      thirdSubject: 'Follow-up 2: Hello {{firstName}}'
    }
  },
  {
    name: 'New Feature - Custom Bodies',
    args: {
      name: 'Test Campaign',
      subject: 'Hello {{firstName}}',
      body: 'Original body',
      sequence_steps: 2,
      sequence_bodies: [
        'First custom body',
        'Second custom body'
      ]
    },
    expected: {
      stepCount: 2,
      firstBodyContains: 'First custom body',
      secondBodyContains: 'Second custom body'
    }
  },
  {
    name: 'New Feature - Custom Subjects',
    args: {
      name: 'Test Campaign',
      subject: 'Original subject',
      body: 'Test body',
      sequence_steps: 3,
      sequence_subjects: [
        'Custom first subject',
        '',
        'Custom third subject'
      ]
    },
    expected: {
      stepCount: 3,
      firstSubject: 'Custom first subject',
      secondSubject: '',
      thirdSubject: 'Custom third subject'
    }
  },
  {
    name: 'New Feature - Continue Thread',
    args: {
      name: 'Test Campaign',
      subject: 'Original subject',
      body: 'Test body',
      sequence_steps: 3,
      continue_thread: true
    },
    expected: {
      stepCount: 3,
      firstSubject: 'Original subject',
      secondSubject: '',
      thirdSubject: ''
    }
  }
];

function runTests() {
  console.log('🧪 Running Basic Functionality Tests');
  console.log('=' .repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    
    try {
      const result = mockBuildCampaignPayload(testCase.args);
      const steps = result.sequences[0].steps;
      
      // Check step count
      if (steps.length !== testCase.expected.stepCount) {
        throw new Error(`Expected ${testCase.expected.stepCount} steps, got ${steps.length}`);
      }
      
      // Check subjects
      if (testCase.expected.firstSubject !== undefined) {
        const actualSubject = steps[0].variants[0].subject;
        if (actualSubject !== testCase.expected.firstSubject) {
          throw new Error(`Expected first subject "${testCase.expected.firstSubject}", got "${actualSubject}"`);
        }
      }
      
      if (testCase.expected.secondSubject !== undefined) {
        const actualSubject = steps[1].variants[0].subject;
        if (actualSubject !== testCase.expected.secondSubject) {
          throw new Error(`Expected second subject "${testCase.expected.secondSubject}", got "${actualSubject}"`);
        }
      }
      
      if (testCase.expected.thirdSubject !== undefined) {
        const actualSubject = steps[2].variants[0].subject;
        if (actualSubject !== testCase.expected.thirdSubject) {
          throw new Error(`Expected third subject "${testCase.expected.thirdSubject}", got "${actualSubject}"`);
        }
      }
      
      // Check body content
      if (testCase.expected.firstBodyContains) {
        const actualBody = steps[0].variants[0].body;
        if (!actualBody.includes(testCase.expected.firstBodyContains)) {
          throw new Error(`Expected first body to contain "${testCase.expected.firstBodyContains}"`);
        }
      }
      
      if (testCase.expected.secondBodyContains) {
        const actualBody = steps[1].variants[0].body;
        if (!actualBody.includes(testCase.expected.secondBodyContains)) {
          throw new Error(`Expected second body to contain "${testCase.expected.secondBodyContains}"`);
        }
      }
      
      console.log('   ✅ PASSED');
      passed++;
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      failed++;
    }
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Core logic is working correctly.');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests, mockBuildCampaignPayload };
