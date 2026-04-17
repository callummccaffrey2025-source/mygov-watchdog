set -euo pipefail
# find files that call any of these helpers
files=$(grep -RIl --include='*.tsx' -E '(formatStage\(|formatIsoDate\(|formatDateAU\(|fmtDate\()' src || true)
for f in $files; do
  cp "$f" ".design-backup/$(basename "$f").$(date +%s)"
  # ensure default alias import
  if ! grep -q '^import fmt from "@/lib/format";' "$f"; then
    { echo 'import fmt from "@/lib/format";'; cat "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  # insert single destructuring line once, right after the fmt import
  if ! grep -q 'const { formatStage, formatIsoDate, fmtDate, formatDateAU } = fmt;' "$f"; then
    FMT_LINE=$(grep -n '^import fmt from "@/lib/format";' "$f" | cut -d: -f1 | head -n1)
    awk -v n="$FMT_LINE" '
      NR==n { print; print "const { formatStage, formatIsoDate, fmtDate, formatDateAU } = fmt;"; next }
      { print }
    ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  # remove any earlier single-alias duplicates (idempotent)
  sed -E -i '' '/^const[[:space:]]+formatStage[[:space:]]*=[[:space:]]*fmt\.formatStage;[[:space:]]*$/d' "$f"
  sed -E -i '' '/^const[[:space:]]+formatIsoDate[[:space:]]*=[[:space:]]*fmt\.formatIsoDate;[[:space:]]*$/d' "$f"
  sed -E -i '' '/^const[[:space:]]+fmtDate[[:space:]]*=[[:space:]]*fmt\.fmtDate;[[:space:]]*$/d' "$f"
  sed -E -i '' '/^const[[:space:]]+formatDateAU[[:space:]]*=[[:space:]]*fmt\.formatDateAU;[[:space:]]*$/d' "$f"
  echo "✓ scoped aliases in $f"
done
