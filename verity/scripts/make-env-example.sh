#!/bin/bash
grep -E '^[A-Z_]+=' .env.local | sed 's/=.*/=""/' > .env.example
echo "✓ .env.example created"
