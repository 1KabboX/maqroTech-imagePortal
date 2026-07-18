import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { path: segments } = await ctx.params;
  const relative = segments.join("/");
  const abs = resolveStoragePath(relative);
  if (!abs) return new NextResponse("Bad path", { status: 400 });

  // Path shape: {brandId}/{folderId}/... — designers may only see their own folders
  if (session.user.role !== "ADMIN") {
    const folderId = segments[1];
    const folder = folderId
      ? await prisma.folder.findUnique({ where: { id: folderId }, select: { designerId: true } })
      : null;
    if (!folder || folder.designerId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
