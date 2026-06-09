const { execSync } = require('child_process');
const path = require('path');

function runCommand(command, cwd = __dirname) {
  try {
    execSync(command, { stdio: 'inherit', cwd });
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    console.error('Deployment aborted.');
    process.exit(1);
  }
}

console.log('🚀 Starting EduSkill Production Deployment (Vercel)...\n');

// 1. Check for Vercel CLI
console.log('🔍 Checking for Vercel CLI...');
try {
  execSync('npx vercel --version', { stdio: 'ignore' });
} catch (e) {
  console.log('Vercel CLI not found locally. It will be downloaded via npx.');
}

// 2. Database Setup & Sync
console.log('\n📦 Step 1: Syncing Database & Running Migrations...');
console.log('Ensure your production database credentials are in your .env file!');
runCommand('node check-db.js');

// 3. Deploy Backend (Express API)
console.log('\n⚙️ Step 2: Deploying Backend API to Vercel...');
// We use --prod to force a production deployment
runCommand('npx vercel --prod');

// 4. Deploy Frontend (Next.js)
console.log('\n🌐 Step 3: Deploying Frontend to Vercel...');
const frontendPath = path.join(__dirname, 'frontend');
// Navigate to frontend directory and deploy
runCommand('npx vercel --prod', frontendPath);

console.log('\n✅ Deployment triggered successfully!');
console.log('Please check your Vercel dashboard for the live build status.');