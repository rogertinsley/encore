import { CatalogSearch } from "./CatalogSearch";
import { DiscoverView } from "./DiscoverView";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>;
}) {
  const { album } = await searchParams;
  const initialAlbum = typeof album === "string" ? album.slice(0, 120) : "";
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 font-display text-5xl text-warm-100">Explore</h1>
      <CatalogSearch key={initialAlbum} album={initialAlbum} />
      <DiscoverView />
    </div>
  );
}
