#!/data/data/com.termux/files/usr/bin/bash
set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
PGDATA="$PREFIX/var/lib/postgresql"
PGUSER="$(id -un)"

command -v node >/dev/null 2>&1 || { echo "Node.js չկա․ տեղադրիր nodejs-lts"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL-ը տեղադրված չէ"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl-ը չկա"; exit 1; }

mkdir -p "$PGDATA"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  initdb -D "$PGDATA" -U "$PGUSER" --auth-local=trust --auth-host=trust
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" start
fi

if ! psql -h 127.0.0.1 -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='taxi_lider'" | grep -q 1; then
  createdb -h 127.0.0.1 -U "$PGUSER" taxi_lider
fi

if [ ! -f "$ROOT/.env" ]; then
  JWT_SECRET="$(openssl rand -hex 48)"
  ADMIN_SETUP_KEY="$(openssl rand -hex 32)"
  cat > "$ROOT/.env" <<EOF
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://$PGUSER@127.0.0.1:5432/taxi_lider
JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=*
ADMIN_SETUP_KEY=$ADMIN_SETUP_KEY
EOF
  chmod 600 "$ROOT/.env"
  echo "Ստեղծվեց .env ֆայլը։ Առաջին ադմինի գրանցման բանալին՝"
  echo "$ADMIN_SETUP_KEY"
  echo "Պահիր բանալին գաղտնի տեղում։"
fi

cd "$ROOT"
if [ ! -d node_modules ]; then npm install; fi
echo "TAXI LIDER սերվերը գործարկվում է՝ http://127.0.0.1:3000"
exec npm start
