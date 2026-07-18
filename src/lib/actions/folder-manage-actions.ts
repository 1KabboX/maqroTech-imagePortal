"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { deleteFileStorage, deleteFolderStorage } from "@/lib/storage";

export type ActionResult = { error?: string } | undefined;

const nameSchema = z.string().trim().min(1, "Enter a name").max(120);

async function requireEditableFolder(folderId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DESIGNER") throw new Error("Not authorized");

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.designerId !== session.user.id) throw new Error("Folder not found");
  if (folder.status === "COMPLETED") throw new Error("Folder is locked");

  return { session, folder };
}

function refresh(folderId: string) {
  revalidatePath("/dashboard/folders");
  revalidatePath("/admin/folders");
  revalidatePath(`/dashboard/folders/${folderId}`);
  revalidatePath(`/admin/folders/${folderId}`);
}

export async function renameFolderAction(folderId: string, name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The admin can rename any folder; designers only their own unlocked ones.
  const session = await auth();
  if (!session?.user) return { error: "Not authorized" };

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return { error: "Folder not found" };
  if (session.user.role !== "ADMIN") {
    if (folder.designerId !== session.user.id) return { error: "Folder not found" };
    if (folder.status === "COMPLETED") return { error: "Folder is locked" };
  }
  if (folder.name === parsed.data) return;

  await prisma.$transaction([
    prisma.folder.update({ where: { id: folderId }, data: { name: parsed.data } }),
    prisma.activityLog.create({
      data: {
        folderId,
        actorId: session.user.id,
        action: "FOLDER_RENAMED",
        detail: `${folder.name} → ${parsed.data}`,
      },
    }),
  ]);

  refresh(folderId);
}

export async function renameFileAction(fileId: string, name: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return { error: "File not found" };

  const { session } = await requireEditableFolder(file.folderId);
  if (file.displayName === parsed.data) return;

  await prisma.$transaction([
    prisma.file.update({ where: { id: fileId }, data: { displayName: parsed.data } }),
    prisma.activityLog.create({
      data: {
        folderId: file.folderId,
        actorId: session.user.id,
        action: "FILE_RENAMED",
        detail: `${file.displayName} → ${parsed.data}`,
      },
    }),
  ]);

  refresh(file.folderId);
}

export async function deleteFileAction(fileId: string): Promise<ActionResult> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return { error: "File not found" };

  const { session } = await requireEditableFolder(file.folderId);

  await prisma.$transaction([
    prisma.file.delete({ where: { id: fileId } }),
    prisma.activityLog.create({
      data: {
        folderId: file.folderId,
        actorId: session.user.id,
        action: "FILE_DELETED",
        detail: file.displayName,
      },
    }),
  ]);
  await deleteFileStorage(file.filePath, file.thumbPath);

  refresh(file.folderId);
}

export async function deleteFilesAction(fileIds: string[]): Promise<ActionResult> {
  if (fileIds.length === 0) return { error: "Nothing selected" };

  const files = await prisma.file.findMany({ where: { id: { in: fileIds } } });
  if (files.length === 0) return { error: "Files not found" };

  const folderIds = [...new Set(files.map((f) => f.folderId))];
  if (folderIds.length !== 1) return { error: "Selected files must belong to one folder" };
  const folderId = folderIds[0];

  const { session } = await requireEditableFolder(folderId);

  await prisma.$transaction([
    prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.id) } } }),
    prisma.activityLog.create({
      data: {
        folderId,
        actorId: session.user.id,
        action: "FILES_DELETED",
        detail:
          files.length === 1
            ? files[0].displayName
            : `${files.length} files`,
      },
    }),
  ]);
  for (const f of files) await deleteFileStorage(f.filePath, f.thumbPath);

  refresh(folderId);
}

export async function deleteFolderAction(folderId: string): Promise<ActionResult> {
  const { session, folder } = await requireEditableFolder(folderId);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  await prisma.$transaction([
    prisma.folder.delete({ where: { id: folderId } }),
    ...(admin
      ? [
          prisma.notification.create({
            data: {
              userId: admin.id,
              title: `"${folder.name}" was deleted`,
              body: `${session.user.name ?? "A designer"} removed this folder.`,
              link: "/admin/folders",
            },
          }),
        ]
      : []),
  ]);
  await deleteFolderStorage(folder.brandId, folderId);

  revalidatePath("/dashboard/folders");
  revalidatePath("/admin/folders");
  return;
}

export async function resubmitFolderAction(folderId: string): Promise<ActionResult> {
  const { session, folder } = await requireEditableFolder(folderId);
  if (folder.status !== "DECLINED") return { error: "Only declined folders can be resubmitted" };

  const fileCount = await prisma.file.count({ where: { folderId } });
  if (fileCount === 0) return { error: "Add at least one image before resubmitting" };

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  await prisma.$transaction([
    prisma.folder.update({
      where: { id: folderId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: { folderId, actorId: session.user.id, action: "RESUBMITTED" },
    }),
    ...(admin
      ? [
          prisma.notification.create({
            data: {
              userId: admin.id,
              title: `"${folder.name}" resubmitted`,
              body: "The designer fixed the folder and sent it back for review.",
              link: `/admin/folders/${folderId}`,
            },
          }),
        ]
      : []),
  ]);

  refresh(folderId);
}
