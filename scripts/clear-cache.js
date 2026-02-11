import fs from 'fs';
import path from 'path';

const CACHE_DIR = '.ai-review-cache';

function clearCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('No cache to clear');
    return;
  }

  const files = fs.readdirSync(CACHE_DIR);
  let cleared = 0;

  files.forEach(file => {
    const filePath = path.join(CACHE_DIR, file);
    fs.unlinkSync(filePath);
    cleared++;
  });

  // Remove directory
  fs.rmdirSync(CACHE_DIR);
  
  console.log(`Cleared ${cleared} cache file(s)`);
  console.log('Cache directory removed');
}

clearCache();