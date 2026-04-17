#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

ENV_LOCAL=".env.local"
ENV_FILE=".env"

get_env_var() {
  local file="$1"
  local key="$2"
  [[ -f "${file}" ]] || return 1
  local line
  line="$(grep -m1 "^${key}=" "${file}" 2>/dev/null || true)"
  [[ -n "${line}" ]] || return 1
  local value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:-1}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:-1}"
  fi
  printf "%s" "${value}"
}

URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-}"

if [[ -z "${URL}" ]]; then
  URL="$(get_env_var "${ENV_LOCAL}" "NEXT_PUBLIC_SUPABASE_URL" || get_env_var "${ENV_FILE}" "NEXT_PUBLIC_SUPABASE_URL" || echo "")"
fi

if [[ -z "${KEY}" ]]; then
  KEY="$(get_env_var "${ENV_LOCAL}" "NEXT_PUBLIC_SUPABASE_ANON_KEY" || get_env_var "${ENV_FILE}" "NEXT_PUBLIC_SUPABASE_ANON_KEY" || echo "")"
fi

if [[ -z "${SITE_URL}" ]]; then
  SITE_URL="$(get_env_var "${ENV_LOCAL}" "NEXT_PUBLIC_SITE_URL" || get_env_var "${ENV_FILE}" "NEXT_PUBLIC_SITE_URL" || echo "")"
fi

SITE_URL="${SITE_URL:-http://localhost:3000}"

if [[ -z "${URL}" || -z "${KEY}" ]]; then
  echo "Supabase REST: FAIL (missing credentials)" >&2
  exit 1
fi

mkdir -p public

response_file="$(mktemp)"
trap 'rm -f "${response_file}"' EXIT

status="$(curl --silent --show-error --output "${response_file}" --write-out '%{http_code}' \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  "${URL%/}/rest/v1/bills_mv?select=id,updated_at" || echo "000")"

if [[ "${status}" != "200" ]]; then
  echo "Supabase REST: FAIL (status ${status})" >&2
  exit 1
fi

count="$(NODE_SITE_URL="${SITE_URL%/}" NODE_DEST="public/sitemap.xml" node <<'NODE' "${response_file}"
const fs = require("node:fs");
const path = process.argv[1];
const siteUrl = process.env.NODE_SITE_URL ?? "http://localhost:3000";
const dest = process.env.NODE_DEST ?? "public/sitemap.xml";

let rows = [];
try {
  const raw = fs.readFileSync(path, "utf8");
  rows = raw ? JSON.parse(raw) : [];
} catch (error) {
  console.error("Failed to parse Supabase response as JSON.");
  process.exit(1);
}

const urls = [
  { loc: `${siteUrl}/legislation` },
  ...rows
    .filter((row) => row && typeof row.id === "string" && row.id.length > 0)
    .map((row) => ({
      loc: `${siteUrl}/legislation/${encodeURIComponent(row.id)}`,
      lastmod: typeof row.updated_at === "string" ? row.updated_at : undefined,
    })),
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((entry) => {
    const lines = [`  <url>`, `    <loc>${entry.loc}</loc>`];
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    }
    lines.push('  </url>');
    return lines.join("\n");
  }),
  '</urlset>',
  '',
].join("\n");

fs.writeFileSync(dest, xml, "utf8");
console.log(urls.length);
NODE
)"

echo "Wrote ${count} urls to public/sitemap.xml"
