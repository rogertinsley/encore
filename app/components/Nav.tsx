"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/now-playing", label: "Now Playing" },
  { href: "/discover", label: "Discover" },
  { href: "/history", label: "History" },
  { href: "/editorial", label: "Editorial" },
  { href: "/analytics", label: "Analytics" },
];

export function Nav() {
  const pathname = usePathname();
  const isNowPlaying = pathname === "/now-playing";

  return (
    <header
      className={
        isNowPlaying
          ? "fixed top-0 left-0 right-0 z-20 px-6 py-4"
          : "border-b border-warm-700 px-6 py-4"
      }
    >
      <nav className="max-w-4xl mx-auto flex flex-wrap items-center gap-x-7 gap-y-2">
        <Link
          href="/"
          className={`font-display text-[1.35rem] font-light tracking-[0.08em] mr-2 shrink-0 transition-opacity hover:opacity-80 ${
            isNowPlaying ? "text-white" : "text-warm-100"
          }`}
        >
          Encore
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative text-[0.8rem] py-2 tracking-[0.06em] transition-colors ${
                  active
                    ? isNowPlaying
                      ? "text-white"
                      : "text-warm-100"
                    : isNowPlaying
                      ? "text-white/50 hover:text-white/90"
                      : "text-warm-400 hover:text-warm-200"
                }`}
              >
                {label}
                {active && (
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-px ${
                      isNowPlaying ? "bg-white/50" : "bg-amber-accent"
                    }`}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
