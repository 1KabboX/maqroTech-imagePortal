import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("u")?.toLowerCase().trim() ?? "";
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ available: false, invalid: true });
  }
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  return NextResponse.json({ available: !existing });
}
