#!/usr/bin/env bash
# Download the tutor model into bundle/models/ and verify it against src/tutor/model.json.
# Release builds pack this file into the APK; debug builds don't need it.
# Uses parallel ranged requests: single-connection downloads from the CDN can be very slow.
set -euo pipefail
cd "$(dirname "$0")/.."

field() { node -p "require('./src/tutor/model.json').$1"; }
FILE=$(field file); URL=$(field url); SIZE=$(field size); SHA=$(field sha256)
OUT=bundle/models/$FILE
PARTS=${PARTS:-12}
mkdir -p bundle/models

if [ -f "$OUT" ] && [ "$(stat -c %s "$OUT")" -eq "$SIZE" ]; then
  echo "$OUT already present"
else
  C=$(( (SIZE + PARTS - 1) / PARTS ))
  for i in $(seq 0 $((PARTS - 1))); do
    s=$(( i * C )); e=$(( s + C - 1 )); [ $e -ge "$SIZE" ] && e=$(( SIZE - 1 ))
    cur=$( [ -f "$OUT.part$i" ] && stat -c %s "$OUT.part$i" || echo 0 )
    [ $(( s + cur )) -gt $e ] && continue
    curl -sL --retry 10 --retry-all-errors -r $(( s + cur ))-$e "$URL" >> "$OUT.part$i" &
  done
  wait
  : > "$OUT.tmp"
  for i in $(seq 0 $((PARTS - 1))); do cat "$OUT.part$i" >> "$OUT.tmp"; done
  rm -f "$OUT".part*
  mv "$OUT.tmp" "$OUT"
fi

echo "$SHA  $OUT" | sha256sum -c -
