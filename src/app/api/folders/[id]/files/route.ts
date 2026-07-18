import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveImage } from "@/lib/storage";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const folder = await prisma.folder.findUnique({
    where: { id },
    include: { _count: { select: { files: true } } },
  });
  if (!folder || folder.designerId !== session.user.id) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }
  if (folder.status === "COMPLETED") {
    return NextResponse.json({ error: "Folder is locked" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveImage(buffer, folder.brandId, folder.id, file.name);

    const record = await prisma.file.create({
      data: {
        folderId: folder.id,
        displayName: file.name,
        ...saved,
      },
    });

    // Initial uploads are covered by the folder's UPLOADED activity entry;
    // files added later from the folder manager get their own log line.
    const isInitial = req.nextUrl.searchParams.get("initial") === "1";
    if (!isInitial) {
      await prisma.activityLog.create({
        data: {
          folderId: folder.id,
          actorId: session.user.id,
          action: "FILE_ADDED",
          detail: file.name,
        },
      });
    }

    return NextResponse.json({ id: record.id, displayName: record.displayName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
