import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const CACHE_DIR = '.ai-review-cache';
const CACHE_VERSION = '1.0';

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getCacheKey(filePath, content) {
  const hash = getFileHash(content);
  return `${CACHE_VERSION}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${hash}`;
}

export function getCachedReview(filePath, content) {
  ensureCacheDir();
  
  const cacheKey = getCacheKey(filePath, content);
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const age = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (age < maxAge) {
        console.log('  Using cached review (saved', Math.round(age / 1000 / 60), 'min ago)');
        return cached.issues;
      }
    }
  } catch (error) {
    console.log('  Cache read error:', error.message);
  }
  
  return null;
}

export function cacheReview(filePath, content, issues) {
  ensureCacheDir();
  
  const cacheKey = getCacheKey(filePath, content);
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    const cacheData = {
      filePath,
      timestamp: new Date().toISOString(),
      version: CACHE_VERSION,
      issues
    };
    
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.log('  Cache write error:', error.message);
  }
}

export function clearOldCache(maxAgeDays = 7) {
  ensureCacheDir();
  
  const files = fs.readdirSync(CACHE_DIR);
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  let cleared = 0;
  
  files.forEach(file => {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtime.getTime();
    
    if (age > maxAge) {
      fs.unlinkSync(filePath);
      cleared++;
    }
  });
  
  if (cleared > 0) {
    console.log(`Cleared ${cleared} old cache file(s)`);
  }
}