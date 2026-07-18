"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type DownloadKind = "brand" | "category" | "folder";

export type DownloadManifestEntry = {
  dir: string[];
  displayName: string;
  filePath: string;
};

export type DownloadManifest =
  | { error: string }
  | { root: string; entries: DownloadManifestEntry[] };

/** Returns a unique name within its parent dir, Drive-style: "Name", "Name (2)", … */
function uniqueName(name: string, parentKey: string, used: Map<string, number>) {
  const key = `${parentKey}/${name.toLowerCase()}`;
  const count = (used.get(key) ?? 0) + 1;
  used.set(key, count);
  return count === 1 ? name : `${name} (${count})`;
}

/**
 * Builds the list of files (with subfolder paths) for downloading the selected
 * brands, categories, or folders. Designers only ever get their own folders —
 * the file-serving route enforces the same rule.
 */
export async function getDownloadEntriesAction(
  kind: DownloadKind,
  ids: string[]
): Promise<DownloadManifest> {
  const session = await auth();
  if (!session?.user) return { error: "Not authorized" };
  if (ids.length === 0) return { error: "Nothing selected" };

  const folderWhere: Prisma.FolderWhereInput =
    kind === "brand"
      ? { brandId: { in: ids } }
      : kind === "category"
        ? { categoryId: { in: ids } }
        : { id: { in: ids } };
  if (session.user.role !== "ADMIN") folderWhere.designerId = session.user.id;

  const folders = await prisma.folder.findMany({
    where: folderWhere,
    orderBy: { name: "asc" },
    include: {
      files: { orderBy: { displayName: "asc" } },
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  if (folders.length === 0 || folders.every((f) => f.files.length === 0)) {
    return { error: "No files to download in the selection" };
  }

  // Root folder name + how deep the subfolder path goes, Drive-style:
  // single item selected → the item's name is the root and paths are relative
  // to it; several items → each becomes a subfolder under a shared root.
  const single = ids.length === 1;
  let root: string;
  if (kind === "folder") {
    const categoryNames = new Set(folders.map((f) => f.category.name));
    root = single
      ? folders[0].name
      : categoryNames.size === 1
        ? folders[0].category.name
        : "Folders";
  } else if (kind === "category") {
    const brandNames = new Set(folders.map((f) => f.brand.name));
    root = single
      ? folders[0].category.name
      : brandNames.size === 1
        ? folders[0].brand.name
        : "Categories";
  } else {
    root = single ? folders[0].brand.name : "Brands";
  }

  const usedNames = new Map<string, number>();
  const entries: DownloadManifestEntry[] = [];

  for (const folder of folders) {
    const dir: string[] = [];
    if (kind === "brand" && !single) dir.push(folder.brand.name);
    if (kind === "brand" || (kind === "category" && !single)) dir.push(folder.category.name);
    if (kind !== "folder" || !single) {
      const parentKey = dir.join("/");
      dir.push(uniqueName(folder.name, parentKey, usedNames));
    }

    const fileKey = dir.join("/");
    for (const file of folder.files) {
      entries.push({
        dir,
        displayName: uniqueName(file.displayName, fileKey, usedNames),
        filePath: file.filePath,
      });
    }
  }

  return { root, entries };
}
