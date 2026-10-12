import type { Metadata } from "next";
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

export default function DisplayPage() {
  return <DisplayView />;
}
