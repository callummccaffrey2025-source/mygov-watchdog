set -euo pipefail
FMT="src/lib/format.ts"; mkdir -p .design-backup && cp "$FMT" ".design-backup/format.ts.$(date +%s)"
# ensure default bundle exists
grep -q 'export function formatIsoDate' "$FMT" || exit 0
grep -q 'const format = {' "$FMT" || printf '\nconst format = { fmtDate, formatIsoDate, formatDateAU, formatStage };\nexport default format;\n' >> "$FMT"
echo "✓ format bundle ensured"
