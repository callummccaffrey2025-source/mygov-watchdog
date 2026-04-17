#!/bin/bash
while IFS='=' read -r k v; do
  [[ "$k" =~ ^[A-Z] ]] && echo "$v" | vercel env add "$k" production --force 2>/dev/null
done < .env.local
echo "✓ Synced to Vercel"
