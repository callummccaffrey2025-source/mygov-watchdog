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

if [[ -z "${URL}" ]]; then
  URL="$(get_env_var "${ENV_LOCAL}" "NEXT_PUBLIC_SUPABASE_URL" || get_env_var "${ENV_FILE}" "NEXT_PUBLIC_SUPABASE_URL" || echo "")"
fi

if [[ -z "${KEY}" ]]; then
  KEY="$(get_env_var "${ENV_LOCAL}" "NEXT_PUBLIC_SUPABASE_ANON_KEY" || get_env_var "${ENV_FILE}" "NEXT_PUBLIC_SUPABASE_ANON_KEY" || echo "")"
fi

overall_status=0

if [[ -z "${URL}" || -z "${KEY}" ]]; then
  echo "Supabase REST: FAIL (missing creds)"
  overall_status=1
else
  endpoint="${URL%/}/rest/v1/bills_mv?select=id&limit=1"
  supabase_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}" \
    "${endpoint}" || echo "000")"

  if [[ "${supabase_status}" == "200" ]]; then
    echo "Supabase REST: OK"
  else
    echo "Supabase REST: FAIL (status ${supabase_status})"
    overall_status=1
  fi
fi

ask_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"q":"test"}' \
  "http://localhost:3000/api/ask" || echo "000")"

if [[ "${ask_status}" == "200" ]]; then
  echo "Ask API: OK"
else
  echo "Ask API: FAIL (status ${ask_status})"
  overall_status=1
fi

echo "Doctor exit status: ${overall_status}"

exit "${overall_status}"
