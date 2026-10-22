import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "200kb" },
  },
};

export default nextConfig;
