import React from "react";

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f12] text-white">
      {children}
    </div>
  );
}
