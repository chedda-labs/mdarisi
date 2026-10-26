#!/usr/bin/env bash
# Download every model in src/tutor/models.json and verify its SHA-256.
# Models marked "bundle" go to bundle/models/ (packed into release APKs);
# the rest go to .models/ (pushed to the phone for debug builds and benchmarks).
# Uses parallel ranged requests: single-connection downloads from the CDN can be very slow.
set -euo pipefail
cd "$(dirname "$0")/.."
PARTS=${PARTS:-12}

fetch() {
  local URL=$1 SIZE=$2 SHA=$3 OUT=$4
  if [ -f "$OUT" ] && [ "$(stat -c %s "$OUT")" -eq "$SIZE" ]; then
    echo "$OUT already present"
  else
    local C=$(( (SIZE + PARTS - 1) / PARTS ))
    for i in $(seq 0 $((PARTS - 1))); do
      local s=$(( i * C )) e=$(( i * C + C - 1 ))
      [ $e -ge "$SIZE" ] && e=$(( SIZE - 1 ))
      local cur=0
      [ -f "$OUT.part$i" ] && cur=$(stat -c %s "$OUT.part$i")
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
}

node -e '
const m = require("./src/tutor/models.json");
for (const x of Object.values(m)) console.log([x.url, x.size, x.sha256, (x.bundle ? "bundle/models/" : ".models/") + x.file].join(" "));
' | while read -r url size sha out; do
  mkdir -p "$(dirname "$out")"
  fetch "$url" "$size" "$sha" "$out"
done
