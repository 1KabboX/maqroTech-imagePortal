import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Which folders a designer is allowed to view: their own, plus any the admin
 * has explicitly shared with them — or every folder when the admin has flipped
 * their "sees all folders" flag. Admins are not gated by this; they see all.
 *
 * Kept as a runtime lookup (not baked into the session token) so an admin's
 * visibility change takes effect on the designer's very next request.
 */
export async function visibleFolderFilter(userId: string): Promise<Prisma.FolderWhereInput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { seesAllFolders: true },
  });
  if (user?.seesAllFolders) return {};
  return {
    OR: [{ designerId: userId }, { shares: { some: { designerId: userId } } }],
  };
}

/** True if the designer owns, was shared, or globally sees the given folder. */
export async function canViewFolder(userId: string, folderId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { seesAllFolders: true },
  });
  if (user?.seesAllFolders) return true;
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      OR: [{ designerId: userId }, { shares: { some: { designerId: userId } } }],
    },
    select: { id: true },
  });
  return Boolean(folder);
}
