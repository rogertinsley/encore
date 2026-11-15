import Link from "next/link";

const sections = [
  {
    href: "/shelf",
    title: "Shelf",
    description: "Artists and releases you’ve saved.",
  },
  {
    href: "/activity",
    title: "Lidarr activity",
    description: "Download progress, recent imports, and import failures.",
  },
  {
    href: "/history",
    title: "Listening history",
    description: "Your recent Last.fm scrobbles.",
  },
  {
    href: "/analytics",
    title: "Listening analytics",
    description: "Patterns in your listening over time.",
  },
  {
    href: "/now-playing",
    title: "Now playing",
    description: "Track details and artwork for what’s playing.",
  },
];

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 font-display text-5xl text-warm-100">Library</h1>
      <ul className="divide-y divide-warm-700 border-y border-warm-700">
        {sections.map(({ href, title, description }) => (
          <li key={href}>
            <Link href={href} className="block py-4 hover:text-amber-accent">
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="text-sm text-warm-300">{description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
