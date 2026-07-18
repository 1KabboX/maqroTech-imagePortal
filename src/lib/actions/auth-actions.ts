"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";
import { nextPublicId } from "@/lib/public-id";
import {
  REGISTER_COOKIE,
  REGISTER_COOKIE_MAX_AGE,
  signRegisterToken,
  verifyRegisterToken,
} from "@/lib/register-token";

export type ActionResult = { error?: string } | undefined;

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!email) return { error: "Enter your email" };

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.status === "INVITED") {
    if (!password) return { error: "Enter the temporary password the admin sent you" };
    if (!user.passwordHash) {
      return { error: "Your account isn't ready yet — ask the admin to reset your password" };
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return { error: "Wrong password. Try again" };

    (await cookies()).set(REGISTER_COOKIE, signRegisterToken(email), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: REGISTER_COOKIE_MAX_AGE,
      path: "/",
    });
    redirect("/register");
  }
  if (!user || user.status === "DISABLED") {
    return { error: "This email doesn't have access to the portal" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: user.role === "ADMIN" ? "/admin" : "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Wrong password. Try again" };
    }
    throw err;
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Only letters, numbers, and underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const email = verifyRegisterToken(cookieStore.get(REGISTER_COOKIE)?.value);
  if (!email) {
    return {
      error:
        "Your registration session expired — log in again with the temporary password",
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, username, password } = parsed.data;

  if (String(formData.get("confirm") ?? "") !== password) {
    return { error: "Passwords don't match" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "INVITED") {
    return { error: "This email hasn't been added by the admin yet" };
  }

  const usernameTaken = await prisma.user.findUnique({ where: { username } });
  if (usernameTaken) return { error: "That username's already taken. Try another" };

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId(tx, user.role);
    await tx.user.update({
      where: { id: user.id },
      data: {
        name,
        username,
        passwordHash,
        publicId,
        status: "ACTIVE",
        registeredAt: new Date(),
      },
    });
  });

  cookieStore.delete(REGISTER_COOKIE);

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?registered=1");
    throw err;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
