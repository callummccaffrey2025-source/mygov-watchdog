import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // keep this if you want builds to fail on TS errors:
  // typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
