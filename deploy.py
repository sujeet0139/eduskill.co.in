import subprocess
import os
import sys
import argparse

def run_command(command, cwd=None, exit_on_fail=True):
    """Runs a shell command and exits if it fails."""
    try:
        print(f"\n> Running: {command}")
        subprocess.run(command, shell=True, check=True, cwd=cwd)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Command failed: {command}")
        print(f"Error: {e}")
        if exit_on_fail:
            print("Deployment aborted.")
            sys.exit(1)
        else:
            print("Continuing deployment despite failure...")

def main():
    parser = argparse.ArgumentParser(description="EduSkill Deployment Script")
    parser.add_argument('--skip-db', action='store_true', help="Skip database migration")
    parser.add_argument('--local', action='store_true', help="Run locally instead of deploying to production")
    args = parser.parse_args()

    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, 'frontend')
    env_file = os.path.join(root_dir, '.env')

    print('🚀 Starting EduSkill Production Deployment (Python)...\n')

    # Check for .env file
    if not os.path.exists(env_file):
        print(f"⚠️ .env file not found at {env_file}")
        print("Creating a default .env file...")
        with open(env_file, 'w') as f:
            f.write("DB_HOST=68.178.153.237\n")
            f.write("DB_PORT=3306\n")
            f.write("DB_USER=eduskill\n")
            f.write("DB_PASSWORD=Eduskil@146\n")
            f.write("DB_NAME=eduskill\n")
            f.write("DB_SSL=false\n")
        print("✅ Default .env file created.")
        print("Please update the .env file with your actual MySQL database credentials and run this script again.")
        sys.exit(1)

    # 1. Database Setup & Sync
    if not args.skip_db:
        print('📦 Step 1: Syncing Database & Running Migrations...')
        print('Ensure your production database credentials are in your .env file!')
        run_command('node check-db.js', cwd=root_dir)
    else:
        print('⏭️  Skipping Database Sync (--skip-db provided)...')

    if args.local:
        print('\n💻 Step 2: Starting local server...')
        print('Press Ctrl+C to stop.')
        run_command('node server.js', cwd=root_dir, exit_on_fail=False)
    else:
        # 2. Deploy Backend (Express API)
        print('\n⚙️ Step 2: Deploying Backend API to Vercel...')
        run_command('npx vercel --prod --yes', cwd=root_dir)

        # 3. Deploy Frontend (Next.js)
        print('\n🌐 Step 3: Deploying Frontend to Vercel...')
        if os.path.exists(frontend_dir):
            run_command('npx vercel --prod --yes', cwd=frontend_dir)
        else:
            print(f"⚠️ Frontend directory not found at {frontend_dir}. Skipping frontend deployment.")

        print('\n✅ Deployment triggered successfully!')
        print('Please check your Vercel dashboard for the live build status.')
        
        print('\n🧪 Next Step: Run the smoke tests to verify the deployment.')
        print('Run: python scripts/smoke_test.py')

if __name__ == '__main__':
    # Ensure npx commands work properly in Windows
    if sys.platform == 'win32':
        os.system("color")
    main()