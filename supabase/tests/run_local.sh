#!/usr/bin/env bash
#
# Verify the StudyMate database from scratch against a throwaway PostgreSQL
# cluster.
#
#   supabase/tests/run_local.sh
#
# What this proves that applying migrations to a live project does not:
#   1. every migration in supabase/migrations/ applies cleanly, in order, to an
#      empty database -- what a new contributor or a CI run actually does;
#   2. the RLS policies hold under real cross-user attack (rls_test.sql);
#   3. the reminder worker's claim/complete contract holds
#      (reminder_delivery_test.sql).
#
# Needs only a local PostgreSQL install -- no Docker, no network, no Supabase
# project. The Supabase-managed schemas are stubbed by local_stub.sql.
#
# Exits non-zero on the first failure, so it is safe to gate CI on.

set -euo pipefail

# PostgreSQL refuses to run as root. Re-exec as an unprivileged user that can
# own the server process, preferring the one the postgres package created.
if [[ "$(id -u)" -eq 0 ]]; then
  for candidate in postgres ubuntu nobody; do
    if getent passwd "$candidate" >/dev/null 2>&1; then
      echo "==> Running as root; re-executing as '$candidate' (postgres will not run as root)"
      exec su "$candidate" -s /bin/bash -c "$(printf '%q' "${BASH_SOURCE[0]}")"
    fi
  done
  echo "Running as root and no unprivileged user found to run postgres as." >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

PGBIN="${PGBIN:-}"
if [[ -z "$PGBIN" ]]; then
  # Prefer the newest major version present.
  PGBIN="$(dirname "$(ls -1 /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")"
fi
if [[ ! -x "$PGBIN/initdb" ]]; then
  echo "Could not find initdb. Install PostgreSQL or set PGBIN." >&2
  exit 1
fi

DATA_DIR="$(mktemp -d -t studymate-pg-XXXXXX)"
SOCKET_DIR="$(mktemp -d -t studymate-sock-XXXXXX)"
LOG="$DATA_DIR/server.log"
DB=studymate_test

cleanup() {
  if [[ -f "$DATA_DIR/postmaster.pid" ]]; then
    "$PGBIN/pg_ctl" -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$DATA_DIR" "$SOCKET_DIR"
}
trap cleanup EXIT

echo "==> Initialising a throwaway cluster ($("$PGBIN/postgres" --version))"
"$PGBIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust --no-sync >/dev/null

# Unix socket only: no TCP port to collide with anything already running.
"$PGBIN/pg_ctl" -D "$DATA_DIR" -l "$LOG" \
  -o "-k '$SOCKET_DIR' -c listen_addresses='' -c fsync=off -c full_page_writes=off" \
  -w start >/dev/null

export PGHOST="$SOCKET_DIR"
export PGUSER=postgres

psql -q -c "create database $DB" postgres
export PGDATABASE="$DB"

# ON_ERROR_STOP makes psql exit non-zero on the first SQL error; without it a
# failed migration would scroll past and the run would look green.
PSQL=(psql -v ON_ERROR_STOP=1 -q --no-psqlrc)

echo "==> Applying Supabase-managed schema stubs"
"${PSQL[@]}" -f "$HERE/local_stub.sql"

echo "==> Applying migrations in order"
shopt -s nullglob
for file in "$MIGRATIONS"/*.sql; do
  printf '    %s\n' "$(basename "$file")"
  "${PSQL[@]}" -f "$file"
done

echo
echo "==> RLS penetration test"
psql -v ON_ERROR_STOP=1 --no-psqlrc -f "$HERE/rls_test.sql"

echo
echo "==> Reminder delivery test"
psql -v ON_ERROR_STOP=1 --no-psqlrc -f "$HERE/reminder_delivery_test.sql"

echo
echo "All database checks passed against a clean PostgreSQL cluster."
