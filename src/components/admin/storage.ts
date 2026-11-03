import { supabase } from "@/integrations/supabase/client";
import { STORAGE_BUCKET, publicImageUrl } from "@/lib/queries";

/**
 * Hard limit for a single manhwa image. Matches the `manhwa` bucket's
 * `file_size_limit` (20 MB) configured in the hardening migration.
 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** How many pages can be queued in one upload batch. */
export const MAX_IMAGES_PER_BATCH = 40;

const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Value for `<input type="file" accept="…">`. */
export const IMAGE_ACCEPT = Object.keys(MIME_TO_EXTENSION).join(",");

export const ALLOWED_IMAGE_LABEL = "JPEG, PNG, WebP, AVIF or GIF";

export type UploadedImage = {
  /** Object path inside the `manhwa` bucket. */
  path: string;
  /** Public URL suitable for `cover_url` / `hero_url` / `image_url`. */
  url: string;
  width: number;
  height: number;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}

/** Returns a readable validation error, or `null` when the file can be uploaded. */
export function validateImageFile(file: File): string | null {
  if (!MIME_TO_EXTENSION[file.type]) {
    return `“${file.name}” is not a supported image — use ${ALLOWED_IMAGE_LABEL}.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_IMAGE_BYTES)} per image.`;
  }
  return null;
}

/**
 * Read an image's intrinsic size once the browser has decoded it.
 * Resolves `{ width: 0, height: 0 }` when dimensions cannot be read.
 */
export function measureImage(url: string): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") return Promise.resolve({ width: 0, height: 0 });
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (width: number, height: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve({ width, height });
    };
    image.onload = () => finish(image.naturalWidth, image.naturalHeight);
    image.onerror = () => finish(0, 0);
    const timeout = window.setTimeout(() => finish(0, 0), 10_000);
    image.src = url;
  });
}

/**
 * Upload one image into the public `manhwa` bucket and return everything needed
 * to persist a row (`panels` / `series.cover_url` / `series.hero_url`).
 */
export async function uploadImage(file: File, prefix: string): Promise<UploadedImage> {
  const extension = MIME_TO_EXTENSION[file.type] ?? "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(`Upload failed for “${file.name}” — ${error.message}`);
  }
  const url = publicImageUrl(path);
  const dimensions = await measureImage(url);
  return { path, url, ...dimensions };
}

/** Extract the bucket object path from a public Supabase storage URL. */
function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const encodedPath = url.slice(index + marker.length).split(/[?#]/)[0];
  if (!encodedPath) return null;
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

/**
 * Best-effort removal of a stored image (e.g. when a cover is replaced).
 * Failures are logged but never surface: orphaned objects are harmless, whereas
 * a failed database write must not be reported as an upload failure.
 */
export async function removeStoredImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    console.warn("[storage] could not remove image", error.message);
  }
}
