import subprocess
import os
import sys
import time

def run_command(command, cwd=None):
    """Runs a command and exits if it fails."""
    print(f"▶️  Running command: {' '.join(command)}")
    # Use capture_output=True to get stdout
    try:
        # Using shell=True on Windows for npx, but passing a list is safer
        # on Linux/macOS. For cross-platform, we can be explicit.
        is_windows = sys.platform == "win32"
        
        # We want to capture the output to get the deployment URL
        # On Windows, 'npx' might be a .cmd file, requiring shell=True
        # or finding the exact path. Using shell=True is simpler here.
        if is_windows:
            result = subprocess.run(" ".join(command), check=True, shell=True, cwd=cwd, capture_output=True, text=True)
            return result.stdout
        else:
            result = subprocess.run(command, check=True, cwd=cwd, capture_output=True, text=True)
            return result.stdout
            
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Command failed with exit code {e.returncode}: {' '.join(command)}")
        print("Deployment aborted.")
        sys.exit(1)
    except FileNotFoundError:
        print(f"\n❌ Command not found: {command[0]}. Is it in your PATH?")
        print("Deployment aborted.")
        sys.exit(1)

def get_deployment_url(output):
    """Parses Vercel CLI output to find the deployment URL."""
    for line in output.splitlines():
        # Look for the line that starts with "Inspect" or "Production" and contains the .vercel.app URL
        if 'vercel.app' in line and ('Inspect' in line or 'Production' in line):
            # Find the URL in the line
            url = next((word for word in line.split() if 'vercel.app' in word), None)
            if url: return url
    return None

def ask_question(query):
    """Asks a yes/no question to the user."""
    answer = input(f"{query} (y/n) ").lower().strip()
    return answer == 'y'

def main():
    """Main deployment function."""
    print('🚀 Starting EduSkill Production Deployment (Vercel)...\n')

    # --- Step 1: Confirmation ---
    print('------------------------------------------------------')
    print('⚠️  You are about to deploy to PRODUCTION.')
    print('------------------------------------------------------')
    if not ask_question('Are you sure you want to continue?'):
        print('Deployment cancelled.')
        sys.exit(0)

    # Check for --skip-db flag
    skip_db = '--skip-db' in sys.argv

    # --- Step 2: Database Sync ---
    if not skip_db:
        print('\n📦 Step 2: Syncing Database & Running Migrations...')
        print('   (Use --skip-db flag to bypass this step)')
        run_command(['npm', 'run', 'db:setup'])
        print('   ✓ Database sync complete.')
    else:
        print('\n- Step 2: Skipping database sync as requested.')

    # --- Step 3: Pre-flight Checks ---
    print('\n🔍 Step 3: Running pre-flight checks...')
    
    # We can just let run_command handle the check for Vercel CLI
    print('  - Vercel CLI will be used via npx.')
    
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    if not os.path.isdir(frontend_path):
        print(f"\n❌ Frontend directory not found at: {frontend_path}")
        print('Deployment aborted.')
        sys.exit(1)
    print('  ✓ Frontend directory exists.')

    # --- Step 4: Deploy Backend with --force to clear build cache ---
    print('\n\n⚙️  Step 4: Deploying Backend API to Vercel...')
    # First, deploy to get a unique URL. The --force flag clears the remote build cache.
    backend_output = run_command(['npx', 'vercel', '--force'])
    backend_url = get_deployment_url(backend_output)
    if not backend_url:
        print("❌ Could not determine backend deployment URL. Aborting.")
        sys.exit(1)
    print(f"   ✓ Backend deployed to: {backend_url}")
    
    # Now, alias this specific deployment to production
    print("   Promoting backend deployment to production...")
    run_command(['npx', 'vercel', 'alias', 'set', backend_url, 'api.eduskill.co.in'])

    # --- Step 5: Deploy Frontend with --force ---
    print('\n\n🌐 Step 5: Deploying Frontend to Vercel...')
    frontend_output = run_command(['npx', 'vercel', '--force'], cwd=frontend_path)
    frontend_url = get_deployment_url(frontend_output)
    if not frontend_url:
        print("❌ Could not determine frontend deployment URL. Aborting.")
        sys.exit(1)
    print(f"   ✓ Frontend deployed to: {frontend_url}")
    
    print("   Promoting frontend deployment to production...")
    run_command(['npx', 'vercel', 'alias', 'set', frontend_url, 'eduskill.co.in'], cwd=frontend_path)

    print('\n\n✅ Deployments triggered successfully!')
    print('   Waiting a moment for deployments to go live before smoke testing...')
    time.sleep(60)  # Wait 60 seconds for Vercel builds to likely complete

    # --- Step 6: Run Smoke Test ---
    smoke_test_path = os.path.join(os.path.dirname(__file__), 'scripts', 'smoke_test.py')
    print('\n\n🔥 Step 6: Running Production Smoke Test...')
    print('   This will verify that the new deployments are healthy.')
    run_command(['python', smoke_test_path])

    print('\n\n🎉 Deployment process complete! Check the smoke test results above.')

if __name__ == "__main__":
    main()