"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { deleteFolderStorage } from "@/lib/storage";

export type ActionResult =
  | { error?: string; success?: string; password?: string; email?: string }
  | undefined;

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Not authorized");
  return session;
}

export async function addDesignerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = z.string().email().safeParse(
    String(formData.get("email") ?? "").toLowerCase().trim()
  );
  if (!parsed.success) return { error: "Enter a valid email" };
  const email = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error:
        existing.status === "INVITED"
          ? "This email is already added — use Reset password to get a new temporary password"
          : "This email already has an account",
    };
  }

  const { randomBytes } = await import("node:crypto");
  const bcrypt = (await import("bcryptjs")).default;
  const password = randomBytes(4).toString("hex"); // 8 chars
  await prisma.user.create({
    data: {
      email,
      role: "DESIGNER",
      status: "INVITED",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  revalidatePath("/admin/designers");
  return { success: email, password, email };
}

export async function resetDesignerPasswordAction(
  userId: string
): Promise<{ error?: string; password?: string }> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "DESIGNER") {
    return { error: "This account can't get a password reset" };
  }

  const { randomBytes } = await import("node:crypto");
  const bcrypt = (await import("bcryptjs")).default;
  const password = randomBytes(4).toString("hex"); // 8 chars
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  return { password };
}

export async function deleteDesignerAction(
  userId: string
): Promise<{ error?: string } | undefined> {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { folders: { select: { id: true, brandId: true } } },
  });
  if (!user || user.role !== "DESIGNER") return { error: "Designer not found" };

  await prisma.$transaction([
    prisma.folder.deleteMany({ where: { designerId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  for (const f of user.folders) await deleteFolderStorage(f.brandId, f.id);

  revalidatePath("/admin/designers");
  revalidatePath("/admin/folders");
  return;
}

export async function setDesignerStatusAction(userId: string, disable: boolean) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "DESIGNER") return;

  if (user.status === "INVITED" && disable) {
    await prisma.user.delete({ where: { id: userId } });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { status: disable ? "DISABLED" : "ACTIVE" },
    });
  }

  revalidatePath("/admin/designers");
}
