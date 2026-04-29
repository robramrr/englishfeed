import "dotenv/config";
import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const execAsync = promisify(exec);

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const GENERAL_TAGS = ["english", "lesson", "beginner", "practice", "vocabulary"];
const GENERAL_TAGS_SET = new Set(GENERAL_TAGS);

function hasExactlyGeneralTags(tags: string[]): boolean {
  if (!Array.isArray(tags) || tags.length !== GENERAL_TAGS.length) return false;
  const normalized = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (normalized.length !== GENERAL_TAGS.length) return false;
  const set = new Set(normalized);
  if (set.size !== GENERAL_TAGS.length) return false;
  for (const t of set) {
    if (!GENERAL_TAGS_SET.has(t)) return false;
  }
  return true;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const R2_ENDPOINT = requireEnv("R2_ENDPOINT");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");

const client = new S3Client({
  endpoint: R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET = requireEnv("R2_BUCKET");
const R2_PUBLIC_URL = requireEnv("R2_PUBLIC_URL");

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  subtitlesUrl: string;
  level: string;
  topic: string;
  tags: string[];
  durationSeconds?: number;
}

async function listAllVideos(): Promise<string[]> {
  let videos: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        ContinuationToken: continuationToken,
      })
    );
    const keys = res.Contents?.map(obj => obj.Key!).filter(k => k.endsWith(".mp4") && !k.includes("/")) || [];
    videos.push(...keys);
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return videos;
}

function titleCase(base: string) {
  return base.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function runScript(script: string, arg: string) {
  console.log(`Running: ${script} ${arg}`);
  const { stdout } = await execAsync(`npm run ${script} -- "${arg}"`);
  return stdout.trim();
}

async function main() {
  const videos = await listAllVideos();
  const lessonsPath = path.join("src", "data", "lessons.json");
  const lessonsData: Lesson[] = JSON.parse(fs.readFileSync(lessonsPath, "utf-8"));

  for (const filename of videos) {
    const base = path.basename(filename, ".mp4");
    const id = base;
    const existing = lessonsData.find((l) => l.id === id);
    const isNewLesson = !existing;

    const lesson: Lesson = existing ?? {
      id,
      title: titleCase(base),
      description: "Auto-generated lesson",
      videoUrl: `${R2_PUBLIC_URL}/${filename}`,
      thumbnailUrl: `${R2_PUBLIC_URL}/thumbnails/${base}.jpg`,
      subtitlesUrl: `/subtitles/${base}.json`,
      level: "beginner",
      topic: "general",
      tags: [],
      durationSeconds: 60,
    };

    if (isNewLesson) {
      lessonsData.push(lesson);
      console.log(`Added lesson: ${id}`);
    }

    const needsTagFix = !hasExactlyGeneralTags(lesson.tags);
    const needsTextDerivation =
      lesson.description === "Auto-generated lesson" ||
      needsTagFix ||
      lesson.title === titleCase(base);

    // Generate everything automatically
    if (isNewLesson || needsTextDerivation) {
      await runScript("generate:subtitles", filename);
    }

    // Derive a meaningful title/description from the generated subtitles.
    // This keeps ingest deterministic and avoids relying on non-existent scripts.
    if (needsTextDerivation) {
      try {
      const subtitlesPath = path.join(
        process.cwd(),
        "public",
        "subtitles",
        `${base}.json`
      );
      if (fs.existsSync(subtitlesPath)) {
        const subtitlesRaw = fs.readFileSync(subtitlesPath, "utf-8");
        const subtitlesJson = JSON.parse(subtitlesRaw) as {
          segments?: Array<{ text?: string }>;
          text?: string;
        };
        const fullText =
          typeof subtitlesJson.text === "string" && subtitlesJson.text.trim()
            ? subtitlesJson.text
            : (subtitlesJson.segments ?? [])
                .map((s) => (typeof s.text === "string" ? s.text : ""))
                .filter(Boolean)
                .join(" ")
                .trim();

        if (fullText) {
          const firstSentence =
            fullText.trim().split(/[.!?]/)[0]?.trim() || titleCase(base);
          lesson.title = firstSentence.slice(0, 60).trim();
          lesson.description = fullText
            .slice(0, 120)
            .trim()
            .replace(/\s+/g, " ");

          // Only apply 5 consistent general tags (avoid random transcript-derived tags).
          if (needsTagFix) {
            lesson.tags = [...GENERAL_TAGS];
          }
        }
      }
      } catch (e) {
      console.warn(`Failed to derive title/description/tags for ${id}:`, e);
      }
    }

    if (isNewLesson) {
      await runScript("generate:practice-sentences", id);
    }

    if (isNewLesson || needsTextDerivation) {
      console.log(`Generated subtitles: ${filename}`);
      console.log(
        `Tags for ${id}: ${lesson.tags.length ? lesson.tags.join(", ") : "none"}`
      );
    }
  }

  fs.writeFileSync(lessonsPath, JSON.stringify(lessonsData, null, 2));
  console.log("All new lessons ingested and processed.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
