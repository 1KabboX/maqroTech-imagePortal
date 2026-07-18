"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { deleteFolderStorage } from "@/lib/storage";

export type ActionResult = { error?: string } | undefined;

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Not authorized");
  return session;
}

function refresh(folderId: string) {
  revalidatePath("/admin/folders");
  revalidatePath(`/admin/folders/${folderId}`);
  revalidatePath("/dashboard/folders");
  revalidatePath(`/dashboard/folders/${folderId}`);
}

export async function declineFolderAction(
  folderId: string,
  note: string
): Promise<ActionResult> {
  const session = await requireAdmin();

  const parsed = z.string().trim().min(3, "Write a note so the designer knows what to fix").max(2000).safeParse(note);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return { error: "Folder not found" };
  if (folder.status === "COMPLETED") return { error: "Unlock the folder first" };

  await prisma.$transaction([
    prisma.folder.update({
      where: { id: folderId },
      data: { status: "DECLINED", adminNote: parsed.data, declinedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        folderId,
        actorId: session.user.id,
        action: "DECLINED",
        detail: parsed.data,
      },
    }),
    prisma.notification.create({
      data: {
        userId: folder.designerId,
        title: `"${folder.name}" declined — needs changes`,
        body: parsed.data,
        link: `/dashboard/folders/${folderId}`,
      },
    }),
  ]);

  refresh(folderId);
}

export async function completeFolderAction(folderId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return { error: "Folder not found" };
  if (folder.status === "COMPLETED") return { error: "Already completed" };

  await prisma.$transaction([
    prisma.folder.update({
      where: { id: folderId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: { folderId, actorId: session.user.id, action: "COMPLETED" },
    }),
    prisma.notification.create({
      data: {
        userId: folder.designerId,
        title: `"${folder.name}" marked as completed`,
        body: "The folder is now locked — the files are in use.",
        link: `/dashboard/folders/${folderId}`,
      },
    }),
  ]);

  refresh(folderId);
}

export async function adminDeleteFolderAction(folderId: string): Promise<ActionResult> {
  await requireAdmin();

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return { error: "Folder not found" };

  await prisma.$transaction([
    prisma.folder.delete({ where: { id: folderId } }),
    prisma.notification.create({
      data: {
        userId: folder.designerId,
        title: `"${folder.name}" was removed by the admin`,
        body: "The folder and its files are no longer on the portal.",
        link: "/dashboard/folders",
      },
    }),
  ]);
  await deleteFolderStorage(folder.brandId, folderId);

  revalidatePath("/admin/folders");
  revalidatePath("/dashboard/folders");
}

export async function unlockFolderAction(folderId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return { error: "Folder not found" };
  if (folder.status !== "COMPLETED") return { error: "Folder isn't locked" };

  await prisma.$transaction([
    prisma.folder.update({
      where: { id: folderId },
      data: { status: "SUBMITTED", completedAt: null },
    }),
    prisma.activityLog.create({
      data: { folderId, actorId: session.user.id, action: "UNLOCKED" },
    }),
  ]);

  refresh(folderId);
}
