import OpenAI from "openai";

declare global {
  // eslint-disable-next-line no-var
  var _openai: OpenAI | undefined;
}

export const openai =
  globalThis._openai ??
  (globalThis._openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "",
  }));
