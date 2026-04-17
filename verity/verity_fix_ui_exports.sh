#!/usr/bin/env bash
set -euo pipefail

green(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }

[ -f package.json ] || { echo "[fail] Run from the project root"; exit 1; }

green "Write ui/button.tsx with default + named export"
mkdir -p src/components/ui
cat > src/components/ui/button.tsx <<'TSX'
"use client";
import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

function ButtonImpl({ className = "", variant = "primary", ...rest }: ButtonProps) {
  const base = "rounded-xl px-4 py-2 font-medium transition";
  const theme =
    variant === "ghost"
      ? "bg-transparent text-white hover:bg-white/10"
      : "bg-emerald text-[#0b0f14] hover:opacity-90";
  return <button className={`${base} ${theme} ${className}`} {...rest} />;
}

export default ButtonImpl;
// Support both import styles:
//   import Button from "@/components/ui/button"
//   import { Button } from "@/components/ui/button"
export { ButtonImpl as Button };
TSX

green "Write ui/card.tsx with default + named export"
cat > src/components/ui/card.tsx <<'TSX'
import React from "react";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

function CardImpl({ className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}
      {...rest}
    />
  );
}

export default CardImpl;
// Support both import styles:
//   import Card from "@/components/ui/card"
//   import { Card } from "@/components/ui/card"
export { CardImpl as Card };
TSX

green "Optionally provide explicit re-export indexes (harmless if unused)"
cat > src/components/ui/index.ts <<'TS'
export { default as Button, Button as ButtonNamed } from "./button";
export { default as Card, Card as CardNamed } from "./card";
TS

green "Clean Next cache and build"
rm -rf .next
pnpm build

green "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
green "Open http://localhost:3000"
