import { openai } from "@/lib/ai/client";

async function ask(prompt: string): Promise<string> {
  const msg = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.choices[0]?.message.content?.trim() ?? "";
}

export interface AlbumReview {
  review: string;
  pullQuote: string;
}

export interface EditorialContent {
  leadReview: AlbumReview | null;
  weeklyDigest: string | null;
  albumReviews: Array<{ artistName: string; albumName: string } & AlbumReview>;
  artistSpotlight: { artistName: string; content: string } | null;
}

export async function generateLeadReview(
  artistName: string,
  albumName: string,
  tags: string[],
  bio: string | null
): Promise<AlbumReview> {
  const tagLine = tags.length
    ? `Genre/tags: ${tags.slice(0, 5).join(", ")}.`
    : "";
  const bioLine = bio ? `Artist context: ${bio.slice(0, 300)}` : "";

  const text =
    await ask(`You are a music critic writing for a prestige music magazine.

Write a 2-3 paragraph review of the album "${albumName}" by ${artistName}.
${tagLine}
${bioLine}

After the review, on a new line write: PULLQUOTE: followed by a single compelling sentence (15-25 words) that would work as a pull quote in a magazine layout.

Be specific, opinionated, and use vivid language. Do not use phrases like "sonic landscape" or "journey".`);

  const [reviewPart, pullPart] = text.split(/PULLQUOTE:/i);
  return {
    review: reviewPart.trim(),
    pullQuote: pullPart?.trim() ?? "",
  };
}

export async function generateWeeklyDigest(
  recentArtists: string[],
  topArtist: string
): Promise<string> {
  const artistList = recentArtists.slice(0, 10).join(", ");
  return ask(`You are writing a personal music column for a reader's private music magazine.

Write a single paragraph (4-6 sentences) about this person's week in music.
Their most played artist this week was ${topArtist}.
Other artists they listened to: ${artistList}.

Write in second person ("You've been..."). Be warm, specific, and slightly literary.
Do not use generic phrases. Reference actual things you know about these artists.`);
}

export async function generateAlbumReview(
  artistName: string,
  albumName: string
): Promise<AlbumReview> {
  const text =
    await ask(`You are a music critic writing for a prestige music magazine.

Write a single paragraph review (4-6 sentences) of "${albumName}" by ${artistName}.

After the review, on a new line write: PULLQUOTE: followed by a single compelling sentence (15-25 words).

Be specific and opinionated. No clichés.`);

  const [reviewPart, pullPart] = text.split(/PULLQUOTE:/i);
  return {
    review: reviewPart.trim(),
    pullQuote: pullPart?.trim() ?? "",
  };
}

export async function generateArtistSpotlight(
  artistName: string
): Promise<string> {
  return ask(`You are writing a "Did You Know?" sidebar for a music magazine.

Write 2-3 sentences of interesting, specific context about ${artistName} —
something a dedicated fan might not know. Focus on recording history,
influences, or a surprising fact. No generic biographical summaries.`);
}
