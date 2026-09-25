#!/usr/bin/env bash
# Har soatda o‘zgarishlarni avtomatik commit qilib, origin/main ga push qiladi.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${HOME}/.cache/getmaster-auto-push.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "== $(date '+%F %T')"

exec 9>"/tmp/getmaster-auto-push.lock"
flock -n 9 || { echo "boshqa jarayon ishlayapti, o‘tkazib yuborildi"; exit 0; }

cd "$REPO"
[ -n "$(git status --porcelain)" ] || { echo "o‘zgarish yo‘q"; exit 0; }

git add -A
# Maxfiy fayllar tasodifan yuklanib ketmasin.
if git diff --cached --name-only | grep -Eiq '(^|/)\.env($|\.(local|production|development))|\.(pem|key|p12)$|id_rsa'; then
  echo "XATO: maxfiy fayl aniqlandi, push bekor qilindi"
  git reset -q
  exit 1
fi

git commit -q -m "Auto-commit: $(date '+%F %H:%M')"
git push -q origin HEAD:main
echo "push qilindi: $(git rev-parse --short HEAD)"
