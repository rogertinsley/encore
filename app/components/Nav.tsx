"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Magazine", routes: ["/", "/editorial"] },
  {
    href: "/discover",
    label: "Explore",
    routes: ["/discover", "/artist", "/new-releases", "/recommendations"],
  },
  {
    href: "/library",
    label: "Library",
    routes: ["/library", "/activity", "/shelf", "/history", "/analytics"],
  },
  { href: "/display", label: "Display", routes: ["/display"] },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header
      className={
        pathname === "/now-playing"
          ? "fixed inset-x-0 top-0 z-20 bg-warm-950/90"
          : "border-b border-warm-700"
      }
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-x-3 px-4 sm:justify-start sm:gap-x-8 sm:px-6"
      >
        <Link
          href="/"
          className="font-display text-2xl text-warm-100 max-[360px]:hidden"
        >
          Encore
        </Link>
        <div className="flex flex-1 items-center justify-between gap-x-2 sm:justify-start sm:gap-x-6">
          {links.map(({ href, label, routes }) => {
            const active = routes.some(
              (route) => pathname === route || pathname.startsWith(route + "/")
            );
            return (
              <Link
                key={href}
                href={href}
                aria-current={
                  pathname === href ? "page" : active ? "location" : undefined
                }
                className={`flex min-h-12 items-center border-b-2 px-1 text-sm sm:text-base ${active ? "border-amber-accent text-warm-100" : "border-transparent text-warm-300 hover:text-warm-100"}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
