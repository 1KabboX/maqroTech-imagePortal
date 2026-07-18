import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  brandId: z.string().min(1),
  categoryName: z.string().trim().min(1).max(60),
  folderName: z.string().trim().min(1).max(120),
  designerNote: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { brandId, categoryName, folderName, designerNote } = parsed.data;

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const folder = await prisma.$transaction(async (tx) => {
    const category = await tx.category.upsert({
      where: { brandId_name: { brandId, name: categoryName } },
      update: {},
      create: { brandId, name: categoryName, createdBy: session.user.id },
    });

    const created = await tx.folder.create({
      data: {
        name: folderName,
        brandId,
        categoryId: category.id,
        designerId: session.user.id,
        designerNote: designerNote || null,
      },
    });

    await tx.activityLog.create({
      data: { folderId: created.id, actorId: session.user.id, action: "UPLOADED" },
    });

    if (session.user.role === "DESIGNER") {
      const admin = await tx.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
      if (admin) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: `New folder "${folderName}" submitted`,
            body: `${session.user.name ?? "A designer"} uploaded a folder under ${brand.name} / ${categoryName}.`,
            link: `/admin/folders/${created.id}`,
          },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ id: folder.id, brandId: folder.brandId });
}
