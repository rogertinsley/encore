export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/config");
    validateEnv();
    const { nowPlayingPipeline } = await import("@/lib/poller/pipeline");
    const { startRecommendationsJob } =
      await import("@/lib/jobs/recommendations");
    const { startNewReleasesJob } = await import("@/lib/jobs/new-releases");
    nowPlayingPipeline.start();
    startRecommendationsJob();
    startNewReleasesJob();
  }
}
