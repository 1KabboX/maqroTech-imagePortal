"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export type ActionResult = { error?: string; success?: string } | undefined;

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Not authorized");
  return session;
}

const nameSchema = z.string().trim().min(1, "Enter a name").max(60);

export async function createBrandAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.brand.findUnique({ where: { name: parsed.data } });
  if (existing) return { error: "A brand with that name already exists" };

  await prisma.brand.create({ data: { name: parsed.data } });
  revalidatePath("/admin/brands");
  revalidatePath("/admin/folders");
  revalidatePath("/dashboard/folders");
  return { success: `Brand "${parsed.data}" added` };
}

/** Designers and the admin can both create categories inside a brand. */
export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Not authorized" };

  const brandId = String(formData.get("brandId") ?? "");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { error: "Brand not found" };

  const existing = await prisma.category.findUnique({
    where: { brandId_name: { brandId, name: parsed.data } },
  });
  if (existing) return { error: "That category already exists in this brand" };

  await prisma.category.create({
    data: { brandId, name: parsed.data, createdBy: session.user.id },
  });

  revalidatePath("/admin/brands");
  revalidatePath("/admin/folders");
  revalidatePath("/dashboard/folders");
  return { success: `Category "${parsed.data}" added` };
}

export async function renameBrandAction(brandId: string, name: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const duplicate = await prisma.brand.findFirst({
    where: { name: parsed.data, NOT: { id: brandId } },
  });
  if (duplicate) return { error: "A brand with that name already exists" };

  await prisma.brand.update({ where: { id: brandId }, data: { name: parsed.data } });
  revalidatePath("/admin/brands");
}

/** Like category creation, renaming is open to both the admin and designers. */
export async function renameCategoryAction(
  categoryId: string,
  name: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Not authorized" };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return { error: "Category not found" };
  if (category.name === parsed.data) return;

  const duplicate = await prisma.category.findUnique({
    where: { brandId_name: { brandId: category.brandId, name: parsed.data } },
  });
  if (duplicate) return { error: "That category already exists in this brand" };

  await prisma.category.update({ where: { id: categoryId }, data: { name: parsed.data } });
  revalidatePath("/admin/brands");
  revalidatePath("/admin/folders");
  revalidatePath("/dashboard/folders");
}

export async function deleteBrandAction(brandId: string): Promise<ActionResult> {
  await requireAdmin();

  const folderCount = await prisma.folder.count({ where: { brandId } });
  if (folderCount > 0) {
    return { error: "Can't delete a brand that has folders. Move or delete them first" };
  }

  await prisma.brand.delete({ where: { id: brandId } });
  revalidatePath("/admin/brands");
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  await requireAdmin();

  const folderCount = await prisma.folder.count({ where: { categoryId } });
  if (folderCount > 0) {
    return { error: "Can't delete a category that has folders" };
  }

  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/admin/brands");
}
