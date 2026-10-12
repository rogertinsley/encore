"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const display = usePathname() === "/display";
  if (display) return <>{children}</>;
  return (
    <>
      <Nav />
      <main className="px-6 py-8">{children}</main>
    </>
  );
}
