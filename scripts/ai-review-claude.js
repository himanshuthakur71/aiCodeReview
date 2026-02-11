import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';

// Import utilities
import { getChangedLinesInFile, getFileContext } from './utils/changed-lines.js';
import { getCachedReview, cacheReview, clearOldCache } from './utils/cache.js';
import { trackReview, getAnalyticsSummary } from './utils/analytics.js';
import { getReviewStrategy, getPromptForStrategy } from './utils/strategy.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function getChangedFiles() {
  try {
    let changedFiles = '';
    
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
      // In GitHub Actions PR
      const baseSha = process.env.PR_BASE_SHA;
      const headSha = process.env.PR_HEAD_SHA;
      
      if (baseSha && headSha) {
        // Method 1: Compare using SHAs
        try {
          changedFiles = execSync(
            `git diff --name-only ${baseSha}...${headSha}`,
            { encoding: 'utf8' }
          );
          console.log('Using SHA comparison');
        } catch (e1) {
          // Method 2: Use HEAD and origin/base
          try {
            const base = process.env.GITHUB_BASE_REF || 'main';
            changedFiles = execSync(
              `git diff --name-only origin/${base}...HEAD`,
              { encoding: 'utf8' }
            );
            console.log('Using branch comparison');
          } catch (e2) {
            // Method 3: Compare last 2 commits
            try {
              changedFiles = execSync(
                'git diff --name-only HEAD~1 HEAD',
                { encoding: 'utf8' }
              );
              console.log('Using commit comparison');
            } catch (e3) {
              console.log('All git methods failed, using fallback');
              return findAllSvelteFiles('./src');
            }
          }
        }
      } else {
        console.log('No PR SHAs available, using fallback');
        return findAllSvelteFiles('./src');
      }
    } else {
      // Local development
      try {
        changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
        if (!changedFiles.trim()) {
          changedFiles = execSync('git diff --name-only main...HEAD', { encoding: 'utf8' });
        }
      } catch (e) {
        console.log('Local git failed, using fallback');
        return findAllSvelteFiles('./src');
      }
    }
    
    const files = changedFiles
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.endsWith('.svelte'))
      .filter(f => f && fs.existsSync(f));
    
    console.log('Found', files.length, 'changed Svelte files');
    return files;
    
  } catch (error) {
    console.log('Error in getChangedFiles:', error.message);
    return findAllSvelteFiles('./src');
  }
}

function findAllSvelteFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  try {
    fs.readdirSync(dir).forEach(item => {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.svelte-kit', 'build'].includes(item)) {
          files.push(...findAllSvelteFiles(full));
        }
      } else if (item.endsWith('.svelte')) {
        files.push(full);
      }
    });
  } catch (e) {
    console.log('Error reading directory:', e.message);
  }
  
  return files;
}


async function reviewWithClaude(filePath, reviewContent, changedLines, strategy) {
  const changedLinesStr = changedLines && changedLines.length > 0 
    ? `Lines ${changedLines.join(', ')}` 
    : 'Entire file';
  
  console.log(`  Strategy: ${strategy.name} | Changed: ${changedLinesStr}`);
  
  try {
    const strategyPrompt = getPromptForStrategy(strategy);
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: strategy.maxTokens,
      temperature: strategy.temperature,
      messages: [{
        role: 'user',
        content: `You are a senior Svelte developer conducting a code review.

${strategyPrompt}

Analyze this code for:
1. **Svelte 5 Best Practices** - Proper runes usage
2. **Accessibility** - WCAG 2.1 AA compliance
3. **Performance** - Re-renders, memory leaks
4. **Security** - XSS, input validation
5. **Code Quality** - Readability, maintainability
6. **Type Safety** - Missing types

For EACH issue provide:
- Exact line number
- The problematic code
- Severity: "critical", "error", "warning", or "info"
- Category: [svelte-5, accessibility, performance, security, code-quality, type-safety]
- Clear explanation
- Specific fix with code
- Impact on users/developers

${changedLines && changedLines.length > 0 ? `
Lines marked with ">" are NEW/CHANGED. Focus on these but consider context.
` : ''}

Return ONLY valid JSON:
[
  {
    "line": 15,
    "code": "$: doubled = count * 2;",
    "severity": "error",
    "category": "svelte-5",
    "issue": "Using deprecated reactive syntax",
    "suggestion": "let doubled = $derived(count * 2);",
    "impact": "Will break in future Svelte versions"
  }
]

If no issues: []

Code:
${reviewContent}

Return ONLY the JSON array.`
      }]
    });
    
    const result = response.content[0].text;
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.log('  No issues found');
      return [];
    }
    
    const issues = JSON.parse(jsonMatch[0]);
    console.log(`  Found ${issues.length} issue(s)`);
    return issues;
    
  } catch (error) {
    console.error('  Claude API error:', error.message);
    return [];
  }
}

async function reviewFile(filePath) {
  console.log('Reviewing:', filePath);
  
  const fullContent = fs.readFileSync(filePath, 'utf-8');
  
  // Check cache first
  const cachedIssues = getCachedReview(filePath, fullContent);
  if (cachedIssues) {
    return cachedIssues;
  }
  
  // Get changed lines
  const changedLines = getChangedLinesInFile(filePath);
  const context = getFileContext(filePath, changedLines);
  
  // Determine strategy
  const strategy = getReviewStrategy(filePath, fullContent, changedLines);
  
  // Review with AI
  const issues = await reviewWithClaude(
    filePath, 
    context.reviewContent, 
    context.changedLines,
    strategy
  );
  
  // Cache result
  cacheReview(filePath, fullContent, issues);
  
  return issues;
}

async function reviewFilesInParallel(files) {
  const BATCH_SIZE = 3;
  const allIssues = [];
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}`);
    
    const batchPromises = batch.map(file => reviewFile(file));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach((issues, idx) => {
      if (issues.length > 0) {
        allIssues.push({ file: batch[idx], issues });
      }
    });
    
    // Rate limiting between batches
    if (i + BATCH_SIZE < files.length) {
      console.log('Waiting before next batch...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  return allIssues;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Enhanced AI Code Review System');
  console.log('='.repeat(60));
  console.log('');
  
  // Clear old cache
  clearOldCache(7);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  
  const files = getChangedFiles();
  
  if (files.length === 0) {
    console.log('No Svelte files changed\n');
    
    const results = {
      timestamp: new Date().toISOString(),
      model: 'claude-3-haiku-20240307',
      filesReviewed: 0,
      filesWithIssues: 0,
      totalIssues: 0,
      criticalCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      reviewStatus: 'approved',
      reviewMessage: 'No Svelte files changed',
      issues: []
    };
    
    fs.writeFileSync('ai-review-results.json', JSON.stringify(results, null, 2));
    process.exit(0);
  }
  
  console.log(`Found ${files.length} changed Svelte file(s)\n`);
  
  // Review files in parallel
  const allIssues = await reviewFilesInParallel(files);
  
  // Calculate statistics
  let criticalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  
  allIssues.forEach(({ issues }) => {
    issues.forEach(issue => {
      switch(issue.severity) {
        case 'critical': criticalCount++; break;
        case 'error': errorCount++; break;
        case 'warning': warningCount++; break;
        case 'info': infoCount++; break;
      }
    });
  });
  
  const totalIssues = criticalCount + errorCount + warningCount + infoCount;
  
  // Determine review status
  let reviewStatus = 'approved';
  let reviewMessage = 'All checks passed!';
  
  if (criticalCount > 0) {
    reviewStatus = 'changes_requested';
    reviewMessage = 'Critical issues found';
  } else if (errorCount > 0) {
    reviewStatus = 'comment';
    reviewMessage = 'Errors found';
  } else if (warningCount > 0) {
    reviewStatus = 'approved';
    reviewMessage = 'Minor warnings';
  }
  
  // Create results
  const results = {
    timestamp: new Date().toISOString(),
    model: 'claude-3-haiku-20240307',
    filesReviewed: files.length,
    filesWithIssues: allIssues.length,
    totalIssues,
    criticalCount,
    errorCount,
    warningCount,
    infoCount,
    reviewStatus,
    reviewMessage,
    changedFiles: files,
    issues: allIssues
  };
  
  // Track analytics
  trackReview(results);
  const analytics = getAnalyticsSummary();
  results.analytics = analytics;
  
  // Save results
  fs.writeFileSync('ai-review-results.json', JSON.stringify(results, null, 2));
  
  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('REVIEW COMPLETE');
  console.log('='.repeat(60));
  console.log('Files Reviewed:', files.length);
  console.log('Total Issues:', totalIssues);
  console.log('  Critical:', criticalCount);
  console.log('  Errors:', errorCount);
  console.log('  Warnings:', warningCount);
  console.log('  Info:', infoCount);
  console.log('Status:', reviewStatus.toUpperCase());
  console.log('='.repeat(60));
  
  if (analytics.totalReviews > 1) {
    console.log('\n' + analytics.insights);
  }
  
  process.exit(criticalCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});