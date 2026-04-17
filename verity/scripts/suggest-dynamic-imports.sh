#!/usr/bin/env bash
grep -RIl --include='*.tsx' -e 'framer-motion' -e '@radix-ui' -e 'recharts' -e '@vercel/og' src | while read -r f; do
  echo "Consider dynamic() for: $f"
done
