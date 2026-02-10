import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function reviewWithClaude(filePath, content) {
  console.log('Reviewing:', filePath);
  
  const lines = content.split('\n');
  const numberedContent = lines.map((line, i) => (i + 1) + ': ' + line).join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `You are an expert Svelte 5 code reviewer. Review this code and provide detailed feedback.

Review for:
1. Svelte 5 runes ($state, $derived, $effect) - proper usage
2. Accessibility (WCAG 2.1 AA)
3. Performance issues
4. Security vulnerabilities
5. Best practices
6. Error handling

For EACH issue, you MUST include:
- Exact line number from the code
- The actual code on that line
- What's wrong
- How to fix it with example code

Return ONLY valid JSON array:
[
  {
    "line": 15,
    "code": "$: displayName = userName.toUpperCase();",
    "severity": "error",
    "category": "svelte-5",
    "issue": "Using old reactive syntax instead of Svelte 5 runes",
    "suggestion": "let displayName = $derived(userName.toUpperCase());"
  }
]

If no issues: []

Code with line numbers:
${numberedContent}

Return ONLY the JSON array, no other text.`
      }]
    });
    
    const result = response.content[0].text;
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.log('  No issues found');
      return [];
    }
    
    const issues = JSON.parse(jsonMatch[0]);
    
    // Add the actual code from the file for each issue
    issues.forEach(issue => {
      if (issue.line && issue.line > 0 && issue.line <= lines.length) {
        // If Claude didn't provide the code, get it from the file
        if (!issue.code) {
          issue.code = lines[issue.line - 1].trim();
        }
      }
    });
    
    console.log('  Found', issues.length, 'issue(s)');
    return issues;
    
  } catch (error) {
    console.error('  Error:', error.message);
    return [];
  }
}

async function reviewAllFiles() {
  console.log('Starting Claude AI Code Review\n');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  
  const files = findSvelteFiles('./src');
  console.log('Found', files.length, 'Svelte files\n');
  
  const allIssues = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log('[' + (i + 1) + '/' + files.length + ']', file);
    
    const content = fs.readFileSync(file, 'utf-8');
    const issues = await reviewWithClaude(file, content);
    
    if (issues.length > 0) {
      allIssues.push({ file, issues });
    }
    
    console.log('');
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Review complete\n');
  
  if (allIssues.length === 0) {
    console.log('No issues found!');
  } else {
    console.log('Issues found in', allIssues.length, 'file(s)');
    allIssues.forEach(({ file, issues }) => {
      console.log('\nFile:', file);
      issues.forEach(i => {
        console.log('  Line', i.line + ':', i.issue);
        console.log('  Code:', i.code);
        console.log('  Fix:', i.suggestion);
      });
    });
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    model: 'claude-3-haiku-20240307',
    filesReviewed: files.length,
    filesWithIssues: allIssues.length,
    totalIssues: allIssues.reduce((sum, f) => sum + f.issues.length, 0),
    issues: allIssues
  };
  
  fs.writeFileSync('ai-review-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to ai-review-results.json');
  
  process.exit(allIssues.length > 0 ? 1 : 0);
}

function findSvelteFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  fs.readdirSync(dir).forEach(item => {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', '.svelte-kit', 'build'].includes(item)) {
        files.push(...findSvelteFiles(full));
      }
    } else if (item.endsWith('.svelte')) {
      files.push(full);
    }
  });
  
  return files;
}

reviewAllFiles().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});