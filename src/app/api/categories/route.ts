import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandId = req.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ categories: [] });

  const categories = await prisma.category.findMany({
    where: { brandId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ categories });
}
