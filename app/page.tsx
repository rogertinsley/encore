import type { Metadata } from "next";
import { Magazine } from "./magazine/Magazine";

export const metadata: Metadata = {
  title: "Music Magazine · Encore",
  description: "Your listening, new releases, and artists to discover.",
};

export default function Home() {
  return <Magazine />;
}
