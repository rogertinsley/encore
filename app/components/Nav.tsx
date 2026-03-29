"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/now-playing", label: "Now Playing" },
  { href: "/discover", label: "Discover" },
  { href: "/history", label: "History" },
  { href: "/editorial", label: "Editorial" },
];

export function Nav() {
  const pathname = usePathname();
  const isNowPlaying = pathname === "/now-playing";

  return (
    <header
      className={
        isNowPlaying
          ? "fixed top-0 left-0 right-0 z-20 px-6 py-4"
          : "border-b border-zinc-800 px-6 py-4"
      }
    >
      <nav className="max-w-4xl mx-auto flex items-center gap-8">
        <span className="text-white font-semibold text-sm tracking-wide">
          Encore
        </span>
        <div className="flex items-center gap-6">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                pathname === href
                  ? "text-white font-medium"
                  : isNowPlaying
                    ? "text-white/60 hover:text-white"
                    : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
