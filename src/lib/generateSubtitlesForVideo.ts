/**
 * Server-only: generate subtitle JSON for a video using OpenAI Whisper.
 * Downloads from R2, transcribes, writes to public/subtitles/<name>.json.
 * Skips if file already exists with non-empty segments (cache).
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";

const R2_PUBLIC_BASE = "https://pub-f15ee3d0e2ea44a6ab6b5985df74d4a5.r2.dev";

function getPaths(videoFilename: string) {
  const projectRoot = process.cwd();
  const publicSubtitlesDir = path.join(projectRoot, "public", "subtitles");
  const videoName = path.basename(videoFilename, path.extname(videoFilename));
  const outputPath = path.join(publicSubtitlesDir, `${videoName}.json`);
  return { projectRoot, publicSubtitlesDir, outputPath, videoName };
}

function subtitleFileExistsWithSegments(outputPath: string): boolean {
  try {
    const raw = fs.readFileSync(outputPath, "utf-8");
    const data = JSON.parse(raw) as { segments?: unknown[] };
    const segments = data?.segments;
    return Array.isArray(segments) && segments.length > 0;
  } catch {
    return false;
  }
}

/** True if the video has no subtitle file or file has empty segments (server-only). */
export function needsSubtitleGeneration(videoFilename: string): boolean {
  if (!videoFilename || !videoFilename.includes(".")) return false;
  const { outputPath } = getPaths(videoFilename);
  return !subtitleFileExistsWithSegments(outputPath);
}

interface VerboseSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface VerboseTranscription {
  segments?: VerboseSegment[];
}

interface OutputSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Generate subtitles for a video. Runs only in Node (server).
 * If the subtitle file already exists with segments, returns immediately (cache).
 * Otherwise downloads the video from R2, runs Whisper, writes JSON.
 */
export async function generateSubtitlesForVideo(videoFilename: string): Promise<void> {
  if (!videoFilename || !videoFilename.includes(".")) return;

  const { projectRoot, publicSubtitlesDir, outputPath, videoName } = getPaths(videoFilename);

  if (subtitleFileExistsWithSegments(outputPath)) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[generateSubtitles] OPENAI_API_KEY missing; skipping subtitle generation.");
    return;
  }

  const r2Url = `${R2_PUBLIC_BASE}/${videoFilename}`;

  const response = await fetch(r2Url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempDir = path.join(projectRoot, "node_modules", ".cache");
  const tempPath = path.join(tempDir, `whisper-${videoName}.mp4`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  fs.writeFileSync(tempPath, buffer);

  try {
    const openai = new OpenAI({ apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      response_format: "verbose_json",
    });

    const data = transcription as unknown as VerboseTranscription;
    const rawSegments = data.segments ?? [];

    const segments: OutputSegment[] = rawSegments
      .filter((seg) => (seg.text ?? "").trim())
      .map((seg, i) => ({
        id: i,
        start: Math.round((seg.start ?? 0) * 100) / 100,
        end: Math.round((seg.end ?? 0) * 100) / 100,
        text: (seg.text ?? "").trim(),
      }));

    const output = { segments };

    if (!fs.existsSync(publicSubtitlesDir)) {
      fs.mkdirSync(publicSubtitlesDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Returns the path to the subtitle file for a video filename (for server-side existence check).
 * Example: carolina-lesson.mp4 -> public/subtitles/carolina-lesson.json absolute path.
 */
export function getSubtitleFilePath(videoFilename: string): string {
  const { outputPath } = getPaths(videoFilename);
  return outputPath;
}
