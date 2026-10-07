#!/usr/bin/env bash
# GetMaster: barcha serverlarni (qayta) ishga tushiradi — tez rejimda (build qilingan backend + tayyor saytlar + tunnel).
# Ishlatish: bash scripts/start-all.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
LOG=/tmp/gm; mkdir -p "$LOG"
TOOLS="$HOME/android-tools"

# 1) eskilarini to‘xtatish (faqat o‘z portlari / tunnel; pkill -f ishlatilmaydi)
for port in 3000 5170 5173 5174 5175; do
  for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null; done
done
for pid in $(pgrep -x cloudflared); do kill "$pid" 2>/dev/null; done
sleep 2

# 2) Docker (postgres, redis, minio, clamav, osrm) — odatda o‘zi ishlab turadi
docker ps --format '{{.Names}}' | grep -q getmaster-postgres || (cd "$ROOT" && docker compose up -d 2>&1 | tail -2)

# 3) backend: kompilyatsiya qilingan kod (nest start dan tezroq)
cd "$ROOT" && npx nest build >"$LOG/build-backend.log" 2>&1
(nohup node dist/main.js >"$LOG/backend.log" 2>&1 &)

# 4) tunnellar (har safar yangi manzil)
for p in 5170 5173 5174 5175 3000; do
  name=tun$p.log; [ "$p" = 3000 ] && name=tunnel.log
  (nohup "$TOOLS/cloudflared/cloudflared" tunnel --url "http://localhost:$p" >"$TOOLS/$name" 2>&1 &)
done
sleep 14
url() { grep -o 'https://[a-z0-9-]*\.trycloudflare.com' "$TOOLS/$1" | head -1; }
SITE=$(url tun5170.log); CUST=$(url tun5173.log); MAST=$(url tun5174.log); ADMIN=$(url tun5175.log); API=$(url tunnel.log)

# 5) saytlarni build qilish (asosiy sayt mijoz/usta tunnel manzillarini biladi)
cd "$WEB"
# (apps/web ichida .env fayllari yo‘q: manzillar quyida buyruq muhiti orqali beriladi)
export VITE_API_BASE_URL=/api/v1
VITE_CUSTOMER_URL="$CUST" VITE_MASTER_URL="$MAST" npx vite build --outDir dist-site --emptyOutDir >"$LOG/build-site.log" 2>&1 &
npx vite build --mode customer --outDir dist-customer --emptyOutDir >"$LOG/build-customer.log" 2>&1 &
npx vite build --mode master --outDir dist-master --emptyOutDir >"$LOG/build-master.log" 2>&1 &
npx vite build --mode admin --outDir dist-admin --emptyOutDir >"$LOG/build-admin.log" 2>&1 &
wait

# 6) tez statik serverlar
for pair in 5170:dist-site 5173:dist-customer 5174:dist-master 5175:dist-admin; do
  (nohup node scripts/serve-dist.mjs "${pair%%:*}" "${pair##*:}" >"$LOG/serve${pair%%:*}.log" 2>&1 &)
done
sleep 6

echo
echo "  Asosiy sayt : $SITE"
echo "  Mijoz sayti : $CUST"
echo "  Usta sayti  : $MAST"
echo "  Admin panel : $ADMIN"
echo "  API (APK)   : $API"
echo "  Backend health: $(curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/v1/health)"
