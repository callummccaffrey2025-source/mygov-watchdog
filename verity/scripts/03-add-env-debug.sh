set -euo pipefail
mkdir -p app/api/debug/env
cat > app/api/debug/env/route.ts <<'TS'
import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set":"unset",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set":"unset",
});}
TS
echo "✓ /api/debug/env ready"
