import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function reviewWithClaude(filePath, content) {
  console.log('Reviewing ' + filePath + ' with Claude...');
  
  const lines = content.split('\n');
  const numberedContent = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are an expert Svelte 5 code reviewer. Review this code and identify issues with EXACT line numbers.

Review for:
1. Svelte 5 runes ($state, $derived, $effect) - are they used correctly?
2. Accessibility (WCAG 2.1 AA)
3. Performance problems
4. Security vulnerabilities
5. Best practices
6. Error handling

CRITICAL: Use the EXACT line numbers shown in the code below.

Return ONLY a valid JSON array:
[
  {
    "line": 15,
    "severity": "error",
    "category": "svelte-5",
    "message": "Using old reactive syntax",
    "suggestion": "Replace with $derived"
  }
]

If no issues: []

File: ${filePath}

Code with line numbers:
\`\`\`svelte
${numberedContent}
\`\`\`

Return ONLY the JSON array, nothing else.`
        }
      ]
    });
    
    const result = response.content[0].text;
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.log('  No JSON found in response');
      return [];
    }
    
    try {
      const issues = JSON.parse(jsonMatch[0]);
      console.log('  Found ' + issues.length + ' issue(s)');
      return issues;
    } catch (e) {
      console.error('  Failed to parse JSON:', e.message);
      return [];
    }
    
  } catch (error) {
    console.error('  Claude API error:', error.message);
    return [];
  }
}

async function reviewAllFiles() {
  console.log('Starting AI Code Review with Claude...\n');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  
  const files = findSvelteFiles('./src');
  console.log('Found ' + files.length + ' Svelte files\n');
  
  const allIssues = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log('[' + (i + 1) + '/' + files.length + '] Reviewing ' + file + '...');
    
    const content = fs.readFileSync(file, 'utf-8');
    
    const lineCount = content.split('\n').length;
    if (lineCount > 1000) {
      console.log('  Skipping (too large: ' + lineCount + ' lines)\n');
      continue;
    }
    
    const issues = await reviewWithClaude(file, content);
    
    if (issues.length > 0) {
      allIssues.push({ file, issues });
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('='.repeat(50) + '\n');
  
  if (allIssues.length === 0) {
    console.log('No issues found!\n');
  } else {
    console.log('Found issues in ' + allIssues.length + ' file(s):\n');
    
    allIssues.forEach(({ file, issues }) => {
      console.log('\n' + file);
      console.log('-'.repeat(50));
      
      issues.forEach(issue => {
        const icon = issue.severity === 'error' ? 'ERROR' : 'WARNING';
        console.log(icon + ' Line ' + issue.line + ' [' + issue.category + ']');
        console.log('  ' + issue.message);
        console.log('  Suggestion: ' + issue.suggestion + '\n');
      });
    });
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    model: 'claude-3-haiku-20240307',
    filesReviewed: files.length,
    filesWithIssues: allIssues.length,
    issues: allIssues
  };
  
  fs.writeFileSync('ai-review-results.json', JSON.stringify(results, null, 2));
  console.log('Results saved to ai-review-results.json\n');
  
  process.exit(allIssues.length > 0 ? 1 : 0);
}

function findSvelteFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !['node_modules', '.svelte-kit', 'build'].includes(item)) {
      files.push(...findSvelteFiles(fullPath));
    } else if (item.endsWith('.svelte')) {
      files.push(fullPath);
    }
  }
  return files;
}

reviewAllFiles().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});