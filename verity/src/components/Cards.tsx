"use client";
import React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      {...rest}
      className={
        "rounded-2xl border border-white/10 bg-white/5 shadow-sm " + className
      }
    />
  );
}

export function Tag({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "info" | "warn" | "success";
  className?: string;
}) {
  const map: Record<string, string> = {
    default: "border-white/15 text-neutral-300",
    info: "border-emerald-400/30 text-emerald-300",
    warn: "border-yellow-400/30 text-yellow-300",
    success: "border-emerald-400/30 text-emerald-300",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs " +
        map[tone] +
        " " +
        className
      }
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "solid",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "outline";
}) {
  const styles = {
    solid:
      "bg-emerald-400 text-neutral-900 hover:bg-emerald-300 disabled:opacity-50",
    ghost:
      "text-emerald-300 hover:bg-white/5 border border-transparent disabled:opacity-50",
    outline:
      "border border-white/15 hover:bg-white/5 text-neutral-100 disabled:opacity-50",
  }[variant];
  return (
    <button
      {...rest}
      className={
        "rounded-xl px-4 py-2 text-sm font-semibold transition " +
        styles +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}
