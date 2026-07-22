import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived proof that a specific file may be read without a session, so
 * another origin (the maqro.tech admin) can fetch images the admin dragged
 * across. The token is bound to one file path — it grants nothing else.
 *
 * Minted during page render and carried in the drag payload, so it has to
 * outlive a browsing session on that page.
 */

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function hmac(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function signFilePath(relativePath: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  return `${exp}.${hmac(`${relativePath}|${exp}`)}`;
}

export function verifyFileToken(relativePath: string, token: string | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;

  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return false;

  const expected = hmac(`${relativePath}|${expStr}`);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
}
