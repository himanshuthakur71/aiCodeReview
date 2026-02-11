import fs from 'fs';

const ANALYTICS_FILE = 'ai-review-analytics.json';

function loadAnalytics() {
  try {
    return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
  } catch {
    return {
      totalReviews: 0,
      totalIssues: 0,
      issuesByCategory: {},
      issuesBySeverity: {},
      fileStats: {},
      patterns: [],
      lastUpdated: null
    };
  }
}

function saveAnalytics(analytics) {
  analytics.lastUpdated = new Date().toISOString();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
}

export function trackReview(results) {
  const analytics = loadAnalytics();
  
  analytics.totalReviews++;
  analytics.totalIssues += results.totalIssues;
  
  // Track by severity
  ['critical', 'error', 'warning', 'info'].forEach(severity => {
    const count = results[severity + 'Count'] || 0;
    analytics.issuesBySeverity[severity] = (analytics.issuesBySeverity[severity] || 0) + count;
  });
  
  // Track by category and file
  results.issues.forEach(({ file, issues }) => {
    if (!analytics.fileStats[file]) {
      analytics.fileStats[file] = { reviews: 0, issues: 0 };
    }
    analytics.fileStats[file].reviews++;
    analytics.fileStats[file].issues += issues.length;
    
    issues.forEach(issue => {
      const cat = issue.category || 'unknown';
      analytics.issuesByCategory[cat] = (analytics.issuesByCategory[cat] || 0) + 1;
    });
  });
  
  saveAnalytics(analytics);
  return analytics;
}

export function generateInsights(analytics) {
  let insights = '## Code Quality Insights\n\n';
  
  insights += `**Total Reviews:** ${analytics.totalReviews}\n`;
  insights += `**Total Issues Found:** ${analytics.totalIssues}\n\n`;
  
  // Top categories
  const topCategories = Object.entries(analytics.issuesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topCategories.length > 0) {
    insights += '### Most Common Issue Types:\n';
    topCategories.forEach(([cat, count], i) => {
      insights += `${i + 1}. **${cat}**: ${count} issues\n`;
    });
    insights += '\n';
  }
  
  // Files needing attention
  const problematicFiles = Object.entries(analytics.fileStats)
    .filter(([_, stats]) => stats.issues > 0)
    .sort((a, b) => b[1].issues - a[1].issues)
    .slice(0, 3);
  
  if (problematicFiles.length > 0) {
    insights += '### Files Needing Attention:\n';
    problematicFiles.forEach(([file, stats]) => {
      const avg = (stats.issues / stats.reviews).toFixed(1);
      insights += `- \`${file}\`: ${stats.issues} issues (avg ${avg} per review)\n`;
    });
    insights += '\n';
  }
  
  // Recommendations
  insights += '### Recommendations:\n';
  if (topCategories[0]?.[0] === 'svelte-5') {
    insights += '- Consider team training on Svelte 5 runes\n';
  }
  if (topCategories[0]?.[0] === 'accessibility') {
    insights += '- Add accessibility linting to pre-commit hooks\n';
  }
  if (topCategories[0]?.[0] === 'security') {
    insights += '- Schedule security review session\n';
  }
  
  return insights;
}

export function getAnalyticsSummary() {
  const analytics = loadAnalytics();
  return {
    totalReviews: analytics.totalReviews,
    totalIssues: analytics.totalIssues,
    topCategory: Object.entries(analytics.issuesByCategory)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
    insights: generateInsights(analytics)
  };
}