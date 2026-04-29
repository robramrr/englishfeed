import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET?.trim() &&
      process.env.R2_PUBLIC_URL?.trim()
  );
}

export function isR2FlashcardConfigured(): boolean {
  return r2Configured();
}

/** Same key shape as `vocab-flashcard-image` upload — must stay in sync. */
export function flashcardObjectKey(word: string, inputHash: string): string {
  const safeSlug =
    word
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "word";
  return `flashcards/${inputHash.slice(0, 16)}-${safeSlug}.png`;
}

/**
 * If the PNG already exists on the public R2 URL (e.g. DB cache row missing), return that URL.
 * Avoids re-running DALL·E when the object is still in the bucket.
 */
export async function tryHeadExistingFlashcardPublicUrl(
  word: string,
  inputHash: string
): Promise<string | null> {
  if (!r2Configured()) return null;
  const key = flashcardObjectKey(word, inputHash).replace(/^\//, "");
  const publicBase = process.env.R2_PUBLIC_URL!.trim().replace(/\/$/, "");
  const url = `${publicBase}/${key}`;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10_000);
  try {
    let res = await fetch(url, { method: "HEAD", signal: ac.signal });
    if (res.ok) return url;
    // Public buckets / CDNs sometimes disallow HEAD; a tiny ranged GET still proves the object exists.
    if (res.status === 403 || res.status === 405) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: ac.signal,
      });
      if (res.ok || res.status === 206) return url;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadFlashcardPngToR2(
  objectKey: string,
  pngBuffer: Buffer
): Promise<string | null> {
  if (!r2Configured()) return null;

  const endpoint = process.env.R2_ENDPOINT!.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!.trim();
  const bucket = process.env.R2_BUCKET!.trim();
  const publicBase = process.env.R2_PUBLIC_URL!.trim().replace(/\/$/, "");

  const client = new S3Client({
    endpoint,
    region: "auto",
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = objectKey.replace(/^\//, "");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pngBuffer,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${publicBase}/${key}`;
}
