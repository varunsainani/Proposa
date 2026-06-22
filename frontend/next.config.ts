import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const API_TARGET = process.env.API_PROXY_TARGET || "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_TARGET}/:path*` },
      { source: "/health", destination: `${API_TARGET}/health` },
    ];
  },
};

export default withNextIntl(nextConfig);
