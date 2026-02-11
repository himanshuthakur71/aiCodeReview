export function getReviewStrategy(filePath, content, changedLines) {
  const lines = content.split('\n').length;
  const fileSize = Buffer.byteLength(content, 'utf8');
  const changedPercent = changedLines ? (changedLines.length / lines) * 100 : 100;
  
  // Determine review depth
  if (lines > 500) {
    return {
      name: 'quick-scan',
      maxTokens: 2048,
      focus: 'critical and security issues only',
      temperature: 0.1
    };
  } else if (lines > 200 || changedPercent < 20) {
    return {
      name: 'standard',
      maxTokens: 3072,
      focus: 'errors and important warnings',
      temperature: 0.2
    };
  } else {
    return {
      name: 'thorough',
      maxTokens: 4096,
      focus: 'detailed review with improvement suggestions',
      temperature: 0.1
    };
  }
}

export function getPromptForStrategy(strategy) {
  const prompts = {
    'quick-scan': 'Focus ONLY on critical bugs and security vulnerabilities. Skip style and minor issues.',
    'standard': 'Review for errors, security issues, and important warnings. Be practical.',
    'thorough': 'Provide comprehensive review including best practices, optimization opportunities, and detailed suggestions.'
  };
  
  return prompts[strategy.name] || prompts.standard;
}