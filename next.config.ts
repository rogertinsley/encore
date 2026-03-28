import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.fanart.tv" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "*.coverartarchive.org" },
    ],
  },
};

export default nextConfig;
