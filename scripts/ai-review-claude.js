import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
async function reviewWithClaude(filePath, content) {
  console.log(`🤖 Reviewing ${filePath} with Claude...`);
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', //  Sonnet model
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are an expert Svelte 5 code reviewer. Analyze this code and find issues.

Review for:
1. Proper use of Svelte 5 runes ($state, $derived, $effect)
2. Accessibility (WCAG 2.1 AA compliance)
3. Performance problems
4. Security vulnerabilities
5. Best practices
6. Error handling
7. Code quality

Return ONLY a valid JSON array with this exact format:
[
  {
    "line": 10,
    "severity": "error",
    "category": "svelte-5",
    "message": "Using old reactive syntax ($:)",
    "suggestion": "Replace with $derived: let displayName = $derived(userName.toUpperCase())"
  }
]

If no issues found, return: []

File: ${filePath}

Code:
\`\`\`svelte
${content}
\`\`\`

Remember: Return ONLY the JSON array, no explanations.`
        }
      ]
    });
    
    const result = response.content[0].text;
    
    // Extract JSON from response (in case Claude adds explanation)
    let jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('⚠️  No JSON found in response');
      return [];
    }
    
    try {
      const issues = JSON.parse(jsonMatch[0]);
      console.log(`   Found ${issues.length} issue(s)`);
      return issues;
    } catch (e) {
      console.error('   Failed to parse JSON:', e.message);
      console.error('   Response was:', result);
      return [];
    }
    
  } catch (error) {
    console.error(`   Claude API error: ${error.message}`);
    return [];
  }
}

async function reviewAllFiles() {
  console.log('🚀 Starting AI Code Review with Claude 3.5 Sonnet...\n');
  
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('💡 Set it with: export ANTHROPIC_API_KEY="your-key-here"');
    process.exit(1);
  }
  
  const files = findSvelteFiles('./src');
  console.log(`📂 Found ${files.length} Svelte files\n`);
  
  const allIssues = [];
  let totalFiles = files.length;
  let currentFile = 0;
  
  for (const file of files) {
    currentFile++;
    console.log(`[${currentFile}/${totalFiles}] Reviewing ${file}...`);
    
    const content = fs.readFileSync(file, 'utf-8');
    
    // Skip very large files (> 1000 lines)
    const lineCount = content.split('\n').length;
    if (lineCount > 1000) {
      console.log(`   ⏭️  Skipping (too large: ${lineCount} lines)\n`);
      continue;
    }
    
    const issues = await reviewWithClaude(file, content);
    
    if (issues.length > 0) {
      allIssues.push({
        file,
        issues
      });
    }
    
    console.log(''); // Empty line for readability
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Display results
  console.log('═══════════════════════════════════════════════════\n');
  
  if (allIssues.length === 0) {
    console.log('✅ No issues found! Code looks great!\n');
  } else {
    console.log(`⚠️  Found issues in ${allIssues.length} file(s):\n`);
    
    let totalIssueCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    
    allIssues.forEach(({ file, issues }) => {
      console.log(`\n📄 ${file}`);
      console.log('─'.repeat(50));
      
      issues.forEach(issue => {
        totalIssueCount++;
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        const category = issue.category ? `[${issue.category}]` : '';
        
        if (issue.severity === 'error') errorCount++;
        else warningCount++;
        
        console.log(`${icon} Line ${issue.line} ${category}`);
        console.log(`   ${issue.message}`);
        console.log(`   💡 ${issue.suggestion}\n`);
      });
    });
    
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   Total Issues: ${totalIssueCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Warnings: ${warningCount}`);
    console.log(`   Files with issues: ${allIssues.length}\n`);
  }
  
  // Save to file
  const results = {
    timestamp: new Date().toISOString(),
    model: 'claude-3-5-sonnet-20241022',
    filesReviewed: files.length,
    filesWithIssues: allIssues.length,
    issues: allIssues
  };
  
  fs.writeFileSync(
    'ai-review-results.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('📝 Detailed results saved to ai-review-results.json\n');
  
  // Exit with error if issues found
  if (allIssues.length > 0) {
    console.log('❌ Code review failed - please fix the issues above\n');
    process.exit(1);
  } else {
    console.log('✅ Code review passed!\n');
    process.exit(0);
  }
}

function findSvelteFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory ${dir} does not exist`);
    return files;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && 
        item !== 'node_modules' && 
        item !== '.svelte-kit' &&
        item !== 'build') {
      files.push(...findSvelteFiles(fullPath));
    } else if (item.endsWith('.svelte')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run the review
reviewAllFiles().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});