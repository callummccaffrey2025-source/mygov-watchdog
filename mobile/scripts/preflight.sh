#!/usr/bin/env bash
# preflight.sh — Pre-App Store submission checklist
#
# Run before `eas build --profile production` to catch common issues.
#
# Usage:
#   bash scripts/preflight.sh

set -euo pipefail

ERRORS=0
WARNINGS=0

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  ? $1"; WARNINGS=$((WARNINGS + 1)); }

echo "Verity Pre-Flight Check"
echo "======================="
echo ""

# ── 1. TypeScript ──────────────────────────────────────────────────────
echo "1. TypeScript"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  fail "TypeScript errors found"
else
  pass "Zero TypeScript errors"
fi
echo ""

# ── 2. Expo Doctor ─────────────────────────────────────────────────────
echo "2. Expo SDK Compatibility"
if npx expo-doctor 2>&1 | grep -q "No issues detected"; then
  pass "expo-doctor: all checks pass"
else
  warn "expo-doctor flagged issues (run 'npx expo-doctor' for details)"
fi
echo ""

# ── 3. App Icon ────────────────────────────────────────────────────────
echo "3. App Icon"
ICON_FILE="assets/icon-appstore.png"
if [ -f "$ICON_FILE" ]; then
  ICON_INFO=$(file "$ICON_FILE" 2>/dev/null)
  if echo "$ICON_INFO" | grep -q "1024 x 1024"; then
    pass "Icon is 1024x1024"
  else
    fail "Icon is not 1024x1024"
  fi
  if echo "$ICON_INFO" | grep -q "RGB"; then
    pass "Icon is RGB (no transparency)"
  else
    fail "Icon may have transparency (must be RGB, no alpha)"
  fi
else
  fail "Icon file not found: $ICON_FILE"
fi
echo ""

# ── 4. Bundle Identifier ──────────────────────────────────────────────
echo "4. Bundle Identifier"
if grep -q '"bundleIdentifier": "au.com.verity.app"' app.json; then
  pass "Bundle ID: au.com.verity.app"
else
  fail "Bundle ID not set correctly in app.json"
fi
echo ""

# ── 5. EAS Config ─────────────────────────────────────────────────────
echo "5. EAS Config"
if grep -q '"ascAppId"' eas.json; then
  pass "ascAppId configured"
else
  fail "ascAppId missing from eas.json"
fi
if grep -q '"appleTeamId"' eas.json; then
  pass "appleTeamId configured"
else
  fail "appleTeamId missing from eas.json"
fi
echo ""

# ── 6. Environment ────────────────────────────────────────────────────
echo "6. Environment"
bash scripts/check_env.sh 2>&1 | grep -E "PASS|FAIL|MISSING"
echo ""

# ── 7. Privacy & Legal ────────────────────────────────────────────────
echo "7. Privacy & Legal"
if grep -q "Cross-Border Data Transfers" screens/PrivacyPolicyScreen.tsx; then
  pass "Privacy Policy has cross-border disclosure"
else
  fail "Privacy Policy missing cross-border disclosure"
fi
if grep -q "AI-Generated Content" screens/TermsScreen.tsx; then
  pass "Terms has AI disclaimer"
else
  fail "Terms missing AI disclaimer"
fi
echo ""

# ── 8. Accessibility ──────────────────────────────────────────────────
echo "8. Accessibility"
A11Y_COUNT=$(grep -rn "accessibilityLabel" --include="*.tsx" --exclude-dir=node_modules . 2>/dev/null | wc -l | tr -d ' ')
if [ "$A11Y_COUNT" -gt 100 ]; then
  pass "$A11Y_COUNT accessibility labels found"
else
  warn "Only $A11Y_COUNT accessibility labels (target: 200+)"
fi
echo ""

# ── 9. IAP ─────────────────────────────────────────────────────────────
echo "9. In-App Purchases"
if grep -q "react-native-iap" package.json; then
  pass "react-native-iap installed"
else
  fail "react-native-iap not installed"
fi
if [ -f "supabase/functions/validate-receipt/index.ts" ]; then
  pass "validate-receipt Edge Function exists"
else
  fail "validate-receipt Edge Function missing"
fi
echo ""

# ── Summary ────────────────────────────────────────────────────────────
echo "======================="
if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS error(s), $WARNINGS warning(s)"
  exit 1
else
  echo "PASS: $WARNINGS warning(s), 0 errors"
  echo ""
  echo "Ready for: eas build --profile production --platform ios"
  exit 0
fi
