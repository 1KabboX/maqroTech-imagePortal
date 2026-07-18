"use client";

/** Shared client-side helpers for gathering image files from drag-and-drop or pickers. */

export const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp"];

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res, rej)
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

export async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) =>
      (entry as FileSystemFileEntry).file(res, rej)
    );
    return [file];
  }
  if (entry.isDirectory) {
    const entries = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    const nested = await Promise.all(entries.map(collectFiles));
    return nested.flat();
  }
  return [];
}

/** Keeps supported image types; everything else is counted as skipped. */
export function filterImages(incoming: File[]): { valid: File[]; skipped: number } {
  const valid: File[] = [];
  let skipped = 0;
  for (const f of incoming) {
    if (ALLOWED_EXT.includes(extOf(f.name))) valid.push(f);
    else skipped++;
  }
  return { valid, skipped };
}
