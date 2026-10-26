#!/usr/bin/env bash
# Samples the app's total PSS every 2 s while it runs: "<epoch ms>\t<PSS KB>" per line.
#   tools/eval/sample-mem.sh > meminfo.tsv
set -uo pipefail
PKG=${PKG:-com.mdarisi.app}
while true; do
  kb=$(adb shell dumpsys meminfo "$PKG" 2>/dev/null | awk '/TOTAL PSS:/ {print $3; exit}')
  [ -n "$kb" ] && printf '%s\t%s\n' "$(date +%s%3N)" "$kb"
  sleep 2
done
