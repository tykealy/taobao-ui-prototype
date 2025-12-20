import type { NextConfig } from "next";

// @ts-ignore - next-pwa doesn't have TypeScript definitions
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {}, // Empty turbopack config to silence warning (next-pwa uses webpack)
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Disable offline caching per requirements
  runtimeCaching: [],
})(nextConfig);
