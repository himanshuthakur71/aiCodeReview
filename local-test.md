# Test locally
npm run ai-review

# Check analytics
npm run ai-analytics

# Clear cache if needed
npm run clear-cache

# Commit and test
git add .
git commit -m "Add enhanced AI review system"
git push origin main

# Create test PR
git checkout -b test/enhanced-system
# Make changes
git add .
git commit -m "test: trigger enhanced review"
git push origin test/enhanced-system