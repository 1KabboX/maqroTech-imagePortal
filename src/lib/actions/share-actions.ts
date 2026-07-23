"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Not authorized");
  return session;
}

export type VisibilityFolder = {
  id: string;
  name: string;
  brandName: string;
  categoryName: string;
  ownedByThisDesigner: boolean;
  shared: boolean;
};

export type DesignerVisibility = {
  seesAll: boolean;
  folders: VisibilityFolder[];
};

/**
 * Everything the admin needs to manage what one designer can see: the full
 * folder list (grouped by brand/category), which are already shared, and
 * whether the designer has blanket "see all" access.
 */
export async function getDesignerVisibilityAction(designerId: string): Promise<DesignerVisibility> {
  await requireAdmin();

  const [designer, folders, shares] = await Promise.all([
    prisma.user.findUnique({ where: { id: designerId }, select: { seesAllFolders: true } }),
    prisma.folder.findMany({
      orderBy: [{ brand: { name: "asc" } }, { category: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        designerId: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.folderShare.findMany({ where: { designerId }, select: { folderId: true } }),
  ]);

  const sharedSet = new Set(shares.map((s) => s.folderId));

  return {
    seesAll: designer?.seesAllFolders ?? false,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      brandName: f.brand.name,
      categoryName: f.category.name,
      ownedByThisDesigner: f.designerId === designerId,
      shared: sharedSet.has(f.id),
    })),
  };
}

/**
 * Saves a designer's visibility in one shot: the blanket "see all" flag plus
 * the exact set of individually shared folders (reconciled — anything not in
 * `folderIds` is un-shared). A designer's own folders are never stored as
 * shares; they are always visible regardless.
 */
export async function updateDesignerVisibilityAction(
  designerId: string,
  seesAll: boolean,
  folderIds: string[]
): Promise<{ error?: string } | undefined> {
  await requireAdmin();

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { id: true, role: true },
  });
  if (!designer || designer.role !== "DESIGNER") return { error: "Designer not found" };

  // Keep only real folders the designer does not already own.
  const selectable = await prisma.folder.findMany({
    where: { id: { in: folderIds }, designerId: { not: designerId } },
    select: { id: true },
  });
  const toShare = selectable.map((f) => f.id);

  await prisma.$transaction([
    prisma.user.update({ where: { id: designerId }, data: { seesAllFolders: seesAll } }),
    prisma.folderShare.deleteMany({ where: { designerId } }),
    ...(seesAll || toShare.length === 0
      ? []
      : [
          prisma.folderShare.createMany({
            data: toShare.map((folderId) => ({ folderId, designerId })),
          }),
        ]),
  ]);

  revalidatePath("/admin/designers");
  revalidatePath("/dashboard/folders");
}
