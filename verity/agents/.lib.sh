read_env () {
  local key="$1"
  local val="$(grep -E "^${key}=" .env.local 2>/dev/null | tail -n1 | cut -d= -f2-)"
  val="$(printf "%s" "$val" | sed -E 's/^[[:space:]]*"(.*)"[[:space:]]*$/\1/')"
  val="$(printf "%s" "$val" | sed -E "s/^[[:space:]]*'(.*)'[[:space:]]*$/\1/")"
  val="$(printf "%s" "$val" | tr -d '\r' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  printf "%s" "$val"
}
