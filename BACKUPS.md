# Database backups

Master-dev-prompt Section I: "Backups and a tested recovery path in case of
DB failure or accidental bulk delete/demap" -- there was none before this.

## What's in place

- **`scripts/backup-db.sh`** -- dumps the live MySQL DB with `mysqldump`,
  gzips it into `backups/eduskill-<timestamp>.sql.gz`, and prunes anything
  older than 14 days.
- **`deploy-server.sh`** now runs it automatically as step 1/7, *before*
  pulling new code or running migrations -- every deploy leaves a same-day
  snapshot behind, independent of whether cron below is set up.

## Set up the daily cron (do this once, on the server)

```bash
crontab -e
```

Add:

```
0 2 * * * bash /var/www/eduskill/current/scripts/backup-db.sh >> /var/log/eduskill-backup.log 2>&1
```

(Adjust the path if `current` isn't a symlink on your setup yet -- point it
at whichever release directory is actually live.)

## Restore (tested procedure -- DESTRUCTIVE, overwrites the live DB)

```bash
cd /var/www/eduskill/current
gunzip -c backups/eduskill-<timestamp>.sql.gz | mysql -u<DB_USER> -p <DB_NAME>
```

Use the same `DB_USER`/`DB_NAME` as in that release's `.env`. You'll be
prompted for the password (or export `MYSQL_PWD` first, same as the backup
script does).

**Before relying on this in an emergency, run it once against a scratch
database to confirm the restore actually completes cleanly on your MySQL
version** -- an untested backup is not a real recovery path, it's a file
that might work.

## What this doesn't cover

- **Off-site copies.** Backups currently live on the same VPS as the live
  DB -- fine against "I broke something with a bad migration," not fine
  against "the VPS itself is gone." Copying `backups/` to a second location
  (another server, S3-compatible storage, etc.) on a schedule is the
  natural next step once you have somewhere to put it.
- **Uploaded files** (`uploads/`, student documents, materials). This only
  backs up the database.
