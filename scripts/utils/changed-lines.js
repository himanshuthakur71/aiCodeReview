import { execSync } from 'child_process';
import fs from 'fs';

export function getChangedLinesInFile(filePath) {
  try {
    const baseBranch = process.env.GITHUB_BASE_REF || 'main';
    
    const diff = execSync(
      `git diff origin/${baseBranch}...HEAD -- "${filePath}"`,
      { encoding: 'utf8' }
    );
    
    const changedLines = new Set();
    const lines = diff.split('\n');
    let currentLine = 0;
    
    for (const line of lines) {
      const match = line.match(/^@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
      if (match) {
        currentLine = parseInt(match[1]);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        changedLines.add(currentLine);
        currentLine++;
      } else if (!line.startsWith('-')) {
        currentLine++;
      }
    }
    
    return Array.from(changedLines).sort((a, b) => a - b);
  } catch (error) {
    return null;
  }
}

export function getFileContext(filePath, changedLines, contextSize = 5) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const allLines = content.split('\n');
  
  if (!changedLines || changedLines.length === 0) {
    return {
      reviewContent: content,
      changedLines: [],
      totalLines: allLines.length,
      fullFile: true
    };
  }
  
  const linesToReview = new Set();
  
  changedLines.forEach(lineNum => {
    for (let i = Math.max(1, lineNum - contextSize); 
         i <= Math.min(allLines.length, lineNum + contextSize); 
         i++) {
      linesToReview.add(i);
    }
  });
  
  const relevantLines = Array.from(linesToReview).sort((a, b) => a - b);
  
  let reviewContent = '';
  let lastLine = 0;
  
  relevantLines.forEach(lineNum => {
    if (lineNum > lastLine + 1) {
      reviewContent += '...\n';
    }
    const marker = changedLines.includes(lineNum) ? '> ' : '  ';
    reviewContent += `${lineNum}: ${marker}${allLines[lineNum - 1]}\n`;
    lastLine = lineNum;
  });
  
  return {
    reviewContent,
    changedLines: Array.from(changedLines),
    totalLines: allLines.length,
    fullFile: false
  };
}