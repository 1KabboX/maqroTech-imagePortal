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

/** Uploads images to a folder one at a time, reporting progress; throws on the first failure. */
export async function uploadImagesToFolder(
  folderId: string,
  files: File[],
  opts: { initial?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<void> {
  const query = opts.initial ? "?initial=1" : "";
  for (let i = 0; i < files.length; i++) {
    const fd = new FormData();
    fd.append("file", files[i]);
    const res = await fetch(`/api/folders/${folderId}/files${query}`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to upload ${files[i].name}`);
    }
    opts.onProgress?.(i + 1, files.length);
  }
}
