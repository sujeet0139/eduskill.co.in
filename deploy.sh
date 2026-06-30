#!/bin/bash

echo "🚀 Starting deployment process..."

# Stage all changes
git add .

# Prompt for a commit message
read -p "📝 Enter commit message (or press enter for default): " msg
msg=${msg:-"chore: deploy changes to production"}

# Commit and push
git commit -m "$msg"
git push origin main

echo "✅ Changes pushed successfully! If your repo is linked to Vercel, it is deploying now."