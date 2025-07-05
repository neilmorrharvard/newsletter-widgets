#!/bin/bash
# push-to-github.sh
# Usage: bash push-to-github.sh
# Make sure to replace the GITHUB_REPO_URL with your actual repo URL!

set -e

# Initialize git if not already initialized
if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "Initial project structure for newsletter widget and Cloudflare Worker"

# Replace this with your actual GitHub repository URL
GITHUB_REPO_URL="https://github.com/YOUR_USERNAME/newsletter-widget.git"

git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_REPO_URL"
git branch -M main
git push -u origin main

echo "\nAll done! Check your repository on GitHub." 