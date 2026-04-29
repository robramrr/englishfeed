/**
 * Generate subtitles from a video's audio using OpenAI Whisper.
 * Downloads the video from Cloudflare R2, runs speech-to-text, saves JSON.
 *
 * Usage: npx tsx scripts/generateSubtitles.ts <video-filename>
 * Example: npx tsx scripts/generateSubtitles.ts video.mp4
 * Example: npx tsx scripts/generateSubtitles.ts carolina-lesson.mp4
 *
 * Output: public/subtitles/<video-name>.json
 * Requires: OPENAI_API_KEY
 */

import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import { generateSubtitlesForVideo } from "../src/lib/generateSubtitlesForVideo";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const videoFilename = process.argv[2];
  if (!videoFilename || !videoFilename.includes(".")) {
    console.error("Usage: npx tsx scripts/generateSubtitles.ts <video-filename>");
    console.error("Example: npx tsx scripts/generateSubtitles.ts video.mp4");
    console.error("Example: npx tsx scripts/generateSubtitles.ts carolina-lesson.mp4");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY environment variable.");
    process.exit(1);
  }

  console.log(`Generating subtitles for: ${videoFilename}`);
  await generateSubtitlesForVideo(videoFilename);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
