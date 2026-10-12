import type { Metadata } from "next";
import { ShelfView } from "./ShelfView";

export const metadata: Metadata = { title: "Listening Shelf · Encore" };

export default function ShelfPage() {
  return <ShelfView />;
}
