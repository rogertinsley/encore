import Anthropic from "@anthropic-ai/sdk";

declare global {
  // eslint-disable-next-line no-var
  var _anthropic: Anthropic | undefined;
}

export const anthropic =
  globalThis._anthropic ??
  (globalThis._anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  }));
