#!/usr/bin/env bash
# Compare the PUBLIC production site to the latest public files on main.
# No Vercel token, secret or admin credentials are needed.
set -euo pipefail
site='https://portfolio-gustavo-chi.vercel.app'
revision="$(git rev-parse --short=12 HEAD)"
paths=(index.html sales.css ambient.css reveal.css reveal.js quote-modal.css player.js channels.js canais.json projetos.json)
stale=0
failed=0
temp="$(mktemp)"
trap 'rm -f "$temp"' EXIT
for file in "${paths[@]}"; do
  route="/$file"
  if [[ "$file" == 'index.html' ]]; then route='/'; fi
  if ! curl -fsSL --retry 2 --retry-delay 2 --connect-timeout 7 --max-time 25 \
    -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' \
    "${site}${route}?build-check=${revision}" -o "$temp"; then
    echo "::warning::Could not retrieve production ${route}"
    failed=$((failed+1))
    continue
  fi
  if cmp -s "$file" "$temp"; then
    echo "MATCH ${route}"
  else
    echo "STALE ${route}"
    stale=$((stale+1))
  fi
done
if (( failed > 0 )); then
  echo "::warning::Production could not be fully checked (${failed} request failures)."
  echo "live=unknown" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi
if (( stale == 0 )); then
  echo "All ${#paths[@]} public files match the latest repository revision."
  echo "live=true" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  echo "::warning::Production still differs from main in ${stale} public file(s)."
  echo "live=false" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
