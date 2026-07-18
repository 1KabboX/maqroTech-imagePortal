import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH ?? "./storage/uploads");

export const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function storageRoot() {
  return STORAGE_ROOT;
}

/** Resolves a DB-stored relative path to an absolute path, refusing traversal outside the root. */
export function resolveStoragePath(relativePath: string): string | null {
  const abs = path.resolve(STORAGE_ROOT, relativePath);
  if (!abs.startsWith(STORAGE_ROOT + path.sep) && abs !== STORAGE_ROOT) return null;
  return abs;
}

export type SavedFile = {
  filePath: string;
  thumbPath: string;
  sizeBytes: number;
  width: number;
  height: number;
};

export async function saveImage(
  buffer: Buffer,
  brandId: string,
  folderId: string,
  originalName: string
): Promise<SavedFile> {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`File type not allowed: ${ext || "unknown"}`);

  const image = sharp(buffer);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("Not a valid image");

  const id = randomUUID();
  const dir = path.join(STORAGE_ROOT, brandId, folderId);
  const thumbDir = path.join(dir, "thumbs");
  await fs.mkdir(thumbDir, { recursive: true });

  const fileName = `${id}${ext}`;
  const thumbName = `${id}.webp`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  await sharp(buffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(thumbDir, thumbName));

  const rel = (...parts: string[]) => parts.join("/");
  return {
    filePath: rel(brandId, folderId, fileName),
    thumbPath: rel(brandId, folderId, "thumbs", thumbName),
    sizeBytes: buffer.byteLength,
    width: meta.width,
    height: meta.height,
  };
}

export async function deleteFolderStorage(brandId: string, folderId: string) {
  const dir = path.join(STORAGE_ROOT, brandId, folderId);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function deleteFileStorage(filePath: string, thumbPath: string) {
  for (const rel of [filePath, thumbPath]) {
    const abs = resolveStoragePath(rel);
    if (abs) await fs.rm(abs, { force: true });
  }
}
