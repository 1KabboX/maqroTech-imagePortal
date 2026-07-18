import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived proof that the designer verified their temporary password at
 * login, so the registration form doesn't need to ask for it again.
 * Carried in an httpOnly cookie — never in the URL.
 */

const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export const REGISTER_COOKIE = "maqro_register";
export const REGISTER_COOKIE_MAX_AGE = MAX_AGE_MS / 1000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function hmac(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function signRegisterToken(email: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = `${email}|${exp}`;
  return Buffer.from(`${payload}|${hmac(payload)}`).toString("base64url");
}

/** Returns the email the token was issued for, or null when invalid/expired. */
export function verifyRegisterToken(token: string | undefined): string | null {
  if (!token) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString();
  } catch {
    return null;
  }
  const parts = decoded.split("|");
  if (parts.length !== 3) return null;
  const [email, expStr, sig] = parts;

  const expected = hmac(`${email}|${expStr}`);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  if (!/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return null;
  return email;
}
