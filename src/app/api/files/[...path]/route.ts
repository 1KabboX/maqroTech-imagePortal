import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { resolveStoragePath } from "@/lib/storage";
import { verifyFileToken } from "@/lib/file-token";
import { canViewFolder } from "@/lib/visibility";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Origins allowed to fetch a token-signed file cross-site — the maqro.tech
 * admin, so images dragged from here can be uploaded there. Set
 * SHARE_ALLOWED_ORIGINS (comma-separated) in production; localhost on any
 * port is allowed in development, where the sibling app's port varies.
 */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (process.env.SHARE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin;
  }
  return null;
}

function withCors(res: NextResponse, origin: string | null) {
  const allowed = allowedOrigin(origin);
  if (allowed) {
    res.headers.set("Access-Control-Allow-Origin", allowed);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!allowedOrigin(origin)) return new NextResponse(null, { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Max-Age", "86400");
  return withCors(res, origin);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const relative = segments.join("/");
  const origin = req.headers.get("origin");

  // A valid signed token stands in for a session — it authorises this one
  // file and nothing else, so no cookie is needed and it works cross-site.
  const token = req.nextUrl.searchParams.get("token");
  const signed = verifyFileToken(relative, token);

  if (!signed) {
    const session = await auth();
    if (!session?.user) return withCors(new NextResponse("Unauthorized", { status: 401 }), origin);

    // Path shape: {brandId}/{folderId}/... — designers may see their own folders
    // plus any the admin has shared with them.
    if (session.user.role !== "ADMIN") {
      const folderId = segments[1];
      if (!folderId || !(await canViewFolder(session.user.id, folderId))) {
        return withCors(new NextResponse("Forbidden", { status: 403 }), origin);
      }
    }
  }

  const abs = resolveStoragePath(relative);
  if (!abs) return withCors(new NextResponse("Bad path", { status: 400 }), origin);

  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const res = new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
    return withCors(res, origin);
  } catch {
    return withCors(new NextResponse("Not found", { status: 404 }), origin);
  }
}
