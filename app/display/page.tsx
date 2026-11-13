import type { Metadata } from "next";
import { LIDARR_WEB_URL } from "@/lib/lidarr/releases";
import { DisplayView } from "./DisplayView";

export const metadata: Metadata = {
  title: "Encore Display",
  description: "Dedicated Now Playing display for Encore",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Encore",
  },
};

export const dynamic = "force-dynamic";

export default function DisplayPage() {
  return (
    <DisplayView
      lidarrConfigured={Boolean(process.env.LIDARR_API_KEY)}
      lidarrUrl={LIDARR_WEB_URL}
    />
  );
}
