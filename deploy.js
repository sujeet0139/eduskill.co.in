const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function runCommand(command, cwd = __dirname) {
  try {
    const result = execSync(command, { cwd, encoding: 'utf-8' });
    process.stdout.write(result);
    return result;
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    console.error('Deployment aborted.');
    process.exit(1);
  }
}

function getDeploymentUrl(output) {
  if (!output) return null;
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/https?:\/\/[\w.-]+\.vercel\.app/);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  // Check for --skip-db flag
  const skipDb = process.argv.includes('--skip-db');

  // --- Step 2: Database Sync ---
  if (!skipDb) {
    console.log('\n📦 Step 2: Syncing Database & Running Migrations...');
    console.log('   (Use --skip-db flag to bypass this step)');
    runCommand('npm run db:setup');
    console.log('   ✓ Database sync complete.');
  } else {
    console.log('\n- Step 2: Skipping database sync as requested.');
  }

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

  const backendDomain = 'api.eduskill.co.in';
  const frontendDomain = 'eduskill.co.in';

  // --- Step 4: Deploy Backend ---
  console.log('\n\n⚙️  Step 4: Deploying Backend API to Vercel...');
  const backendOutput = runCommand('npx vercel --prod --yes');
  const backendUrl = getDeploymentUrl(backendOutput);
  if (!backendUrl) {
    console.error('❌ Could not parse backend deployment URL from Vercel output.');
    process.exit(1);
  }
  console.log(`   ✓ Backend deployed to: ${backendUrl}`);
  console.log(`   ⏳ Aliasing backend deployment to ${backendDomain}...`);
  runCommand(`npx vercel alias set ${backendUrl} ${backendDomain}`);
  console.log('   ✓ Backend alias set successfully.');

  // Wait for a short period to reduce the chance of a race condition on Vercel's end.
  // This gives the backend deployment time to finish before frontend build starts.
  await sleep(15000); // 15 seconds

  // --- Step 5: Deploy Frontend ---
  console.log('\n\n🌐 Step 5: Deploying Frontend to Vercel...');
  const frontendOutput = runCommand('npx vercel --prod --yes', frontendPath);
  const frontendUrl = getDeploymentUrl(frontendOutput);
  if (!frontendUrl) {
    console.error('❌ Could not parse frontend deployment URL from Vercel output.');
    process.exit(1);
  }
  console.log(`   ✓ Frontend deployed to: ${frontendUrl}`);
  console.log(`   ⏳ Aliasing frontend deployment to ${frontendDomain}...`);
  runCommand(`npx vercel alias set ${frontendUrl} ${frontendDomain}`, frontendPath);
  console.log('   ✓ Frontend alias set successfully.');

  console.log('\n\n✅ Deployments triggered successfully!');
  console.log('   Waiting a moment for deployments to go live before smoke testing...');
  await sleep(60000); // Wait 60 seconds for Vercel builds to likely complete

  // --- Step 6: Run Smoke Test ---
  console.log('\n\n🔥 Step 6: Running Production Smoke Test...');
  console.log('   This will verify that the new deployments are healthy.');
  runCommand('python ./scripts/smoke_test.py');

  console.log('\n\n🎉 Deployment process complete! Check the smoke test results above.');
}

main();