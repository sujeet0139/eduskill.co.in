#!/usr/bin/env python3
"""
EduSkill deployment.

ACTUAL architecture (important — the old deploy.py did NOT match this):
  - Frontend (Next.js)  -> Vercel. Auto-builds on every push to GitHub `main`.
  - Backend  (Express)  -> VPS 187.127.162.29, dir /var/www/eduskill,
                           run by pm2 as process "eduskill-api" (port 3003).
  - Database (MySQL)    -> on the VPS itself (DB_HOST=127.0.0.1 in the VPS .env).
                           Schema is synced by check-db.js, which MUST run ON the VPS.

So deploying = (1) push code to GitHub  ->  Vercel rebuilds the frontend
              (2) SSH to the VPS, pull the code, migrate the DB, restart pm2.

Requirements on the machine you run this from:
    pip install paramiko
The VPS SSH password is read from the env var VPS_PASSWORD, or prompted for.

Usage:
    python deploy.py                 # full deploy: push + frontend (Vercel) + backend (VPS) + db
    python deploy.py --no-push       # skip git push; just redeploy current origin/main onto the VPS
    python deploy.py --skip-db       # skip the DB migration step on the VPS
    python deploy.py --backend-only  # don't push; only sync+restart the VPS backend
"""
import argparse
import getpass
import os
import subprocess
import sys

VPS_HOST = "187.127.162.29"
VPS_USER = "root"
VPS_DIR = "/var/www/eduskill"
PM2_APP = "eduskill-api"
HEALTH_URL = "http://localhost:3003/health"


def sh(cmd):
    print(f"\n$ {cmd}")
    subprocess.run(cmd, shell=True, check=True)


def git_push():
    sh("git add -A")
    # commit only if there is something staged
    if subprocess.run("git diff --cached --quiet", shell=True).returncode != 0:
        msg = input("Commit message (enter for default): ").strip() or "chore: deploy"
        sh(f'git commit -m "{msg}"')
    else:
        print("(nothing new to commit)")
    sh("git push origin main")
    print("\n✅ Pushed to GitHub. Vercel will auto-build the FRONTEND from this push.")


def run_remote(client, cmd, label):
    print(f"\n[VPS] $ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=600, get_pty=True)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print("\n".join("   " + l for l in out.splitlines()))
    if err.strip():
        print("\n".join("   ! " + l for l in err.splitlines()))
    if code != 0:
        print(f"\n❌ Step failed ({label}), exit {code}. Aborting before restart.")
        client.close()
        sys.exit(1)
    return out


def deploy_vps(skip_db):
    try:
        import paramiko
    except ImportError:
        print("paramiko is required:  pip install paramiko")
        sys.exit(1)

    pw = os.environ.get("VPS_PASSWORD") or getpass.getpass(f"SSH password for {VPS_USER}@{VPS_HOST}: ")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=pw, timeout=25,
                   look_for_keys=False, allow_agent=False)

    # 1. Sync code to exactly what's on origin/main (.env and node_modules are
    #    git-ignored, so they're left untouched).
    run_remote(client, f"cd {VPS_DIR} && git fetch origin && git reset --hard origin/main && git log --oneline -1", "git sync")

    # 2. Install any new/updated dependencies.
    run_remote(client, f"cd {VPS_DIR} && npm install --omit=dev", "npm install")

    # 3. Migrate the VPS database (idempotent: CREATE TABLE IF NOT EXISTS, etc.).
    if not skip_db:
        run_remote(client, f"cd {VPS_DIR} && node check-db.js", "db migrate")
    else:
        print("\n(skipping DB migration)")

    # 4. Restart the API and health-check.
    run_remote(client, f"pm2 restart {PM2_APP} --update-env", "pm2 restart")
    out = run_remote(client, f"sleep 2 && curl -s -o /dev/null -w '%{{http_code}}' {HEALTH_URL}", "health")
    if out.strip().endswith("200"):
        print("\n✅ Backend healthy (HTTP 200).")
    else:
        print(f"\n⚠️  Health check did not return 200 (got: {out.strip()}). Check: pm2 logs {PM2_APP}")

    client.close()


def main():
    ap = argparse.ArgumentParser(description="EduSkill deploy")
    ap.add_argument("--no-push", action="store_true", help="skip git push")
    ap.add_argument("--skip-db", action="store_true", help="skip DB migration on the VPS")
    ap.add_argument("--backend-only", action="store_true", help="only redeploy the VPS backend (implies --no-push)")
    args = ap.parse_args()

    print("🚀 EduSkill deploy\n")

    if not (args.no_push or args.backend_only):
        git_push()

    deploy_vps(args.skip_db)

    print("\n🎉 Done.")
    print("   Frontend: check the Vercel dashboard for the build triggered by the push.")
    print(f"   Backend:  https://api.eduskill.co.in  (pm2 '{PM2_APP}' on {VPS_HOST})")


if __name__ == "__main__":
    main()
