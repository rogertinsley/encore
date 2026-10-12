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
      { hostname: "lastfm.freetls.fastly.net" },
      { protocol: "https", hostname: "static.qobuz.com" },
      { protocol: "https", hostname: "img.radioparadise.com" },
      // EverSolo serves local album art over HTTP from the device IP
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
