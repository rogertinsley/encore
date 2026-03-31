import { AnalyticsView } from "./AnalyticsView";

export default function AnalyticsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Analytics</h1>
      <p className="text-zinc-500 text-sm mb-8">
        Your listening stats from Last.FM
      </p>
      <AnalyticsView />
    </div>
  );
}
