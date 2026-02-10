import fs from 'fs';
import path from 'path';

// Simple AI review script
async function reviewCode() {
  console.log('🤖 Starting AI Code Review...\n');
  
  // Find all Svelte files that changed
  const svelteFiles = findSvelteFiles('./src');
  
  console.log(`Found ${svelteFiles.length} Svelte files\n`);
  
  // Check each file for common issues
  const issues = [];
  
  for (const file of svelteFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const fileIssues = checkFile(file, content);
    issues.push(...fileIssues);
  }
  
  // Display results
  if (issues.length === 0) {
    console.log('✅ No issues found!');
  } else {
    console.log(`⚠️  Found ${issues.length} issues:\n`);
    issues.forEach(issue => {
      console.log(`File: ${issue.file}`);
      console.log(`Issue: ${issue.message}`);
      console.log(`Suggestion: ${issue.suggestion}\n`);
    });
  }
  
  // Save results to file
  fs.writeFileSync(
    'ai-review-results.json',
    JSON.stringify(issues, null, 2)
  );
}

function findSvelteFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules') {
      files.push(...findSvelteFiles(fullPath));
    } else if (item.endsWith('.svelte')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(file, content) {
  const issues = [];
  
  // Check 1: Using old reactive syntax instead of runes
  if (content.includes('$:') && !content.includes('// legacy')) {
    issues.push({
      file,
      message: 'Using old reactive syntax ($:)',
      suggestion: 'Consider using Svelte 5 runes: $state, $derived, or $effect'
    });
  }
  
  // Check 2: Missing alt text on images
  const imgMatches = content.match(/<img[^>]*>/g) || [];
  for (const img of imgMatches) {
    if (!img.includes('alt=')) {
      issues.push({
        file,
        message: 'Image missing alt text',
        suggestion: 'Add alt="description" to all images for accessibility'
      });
    }
  }
  
  // Check 3: Using div instead of button for click handlers
  if (content.includes('<div') && content.includes('onclick')) {
    issues.push({
      file,
      message: 'Using div with onclick',
      suggestion: 'Use <button> instead of <div> for clickable elements'
    });
  }
  
  // Check 4: Missing error handling in fetch
  if (content.includes('fetch(') && !content.includes('catch')) {
    issues.push({
      file,
      message: 'fetch() without error handling',
      suggestion: 'Always add try-catch or .catch() to handle fetch errors'
    });
  }
  
  // Check 5: Console.log in production code
  if (content.includes('console.log')) {
    issues.push({
      file,
      message: 'console.log found in code',
      suggestion: 'Remove console.log before deploying to production'
    });
  }
  
  return issues;
}

// Run the review
reviewCode().catch(console.error);