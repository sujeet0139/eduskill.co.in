const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function runCommand(command, cwd = __dirname) {
  try {
    execSync(command, { stdio: 'inherit', cwd });
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    console.error('Deployment aborted.');
    process.exit(1);
  }
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  console.log('🚀 Starting EduSkill Production Deployment (Vercel)...\n');

  // --- Step 1: Confirmation ---
  console.log('------------------------------------------------------');
  console.log('⚠️  You are about to deploy to PRODUCTION.');
  console.log('------------------------------------------------------');
  const answer = await askQuestion('Are you sure you want to continue? (y/n) ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Deployment cancelled.');
    process.exit(0);
  }

  // --- Step 2: Database Sync ---
  console.log('\n📦 Step 2: Syncing Database & Running Migrations...');
  console.log('   Ensure your production database credentials are in your .env file!');
  runCommand('npm run db:setup');
  console.log('   ✓ Database sync complete.');

  // --- Step 3: Pre-flight Checks ---
  console.log('\n🔍 Step 3: Running pre-flight checks...');
  try {
    execSync('npx --no-install vercel --version', { stdio: 'ignore' });
    console.log('  ✓ Vercel CLI is available.');
  } catch (e) {
    console.log('  - Vercel CLI not found locally. It will be downloaded via npx.');
  }
  const frontendPath = path.join(__dirname, 'frontend');
  if (!fs.existsSync(frontendPath)) {
    console.error(`\n❌ Frontend directory not found at: ${frontendPath}`);
    console.error('Deployment aborted.');
    process.exit(1);
  }
  console.log('  ✓ Frontend directory exists.');

  // --- Step 4: Deploy Backend ---
  console.log('\n\n⚙️  Step 4: Deploying Backend API to Vercel...');
  runCommand('npx vercel --prod --yes');

  // --- Step 5: Deploy Frontend ---
  console.log('\n\n🌐 Step 5: Deploying Frontend to Vercel...');
  runCommand('npx vercel --prod --yes', frontendPath);

  console.log('\n\n✅ Deployment triggered successfully!');
  console.log('Check your Vercel dashboard for the live build status.');
}

main();