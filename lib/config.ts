const REQUIRED_ENV_VARS = [
  "LASTFM_API_KEY",
  "LASTFM_USERNAME",
  "FANART_TV_API_KEY",
  "OPENAI_API_KEY",
] as const;

/** Throws at startup if any required environment variable is missing. */
export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
