import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.fanart.tv" },
      { hostname: "coverartarchive.org" },
      { hostname: "*.coverartarchive.org" },
      { hostname: "*.archive.org" },
      { protocol: "https", hostname: "*.mzstatic.com" },
    ],
  },
};

export default nextConfig;
