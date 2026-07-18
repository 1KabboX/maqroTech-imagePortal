import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          publicId: user.publicId,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          role: "ADMIN" | "DESIGNER";
          publicId?: string | null;
          username?: string | null;
        };
        token.role = u.role;
        token.publicId = u.publicId;
        token.username = u.username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const t = token as {
          sub?: string;
          role?: "ADMIN" | "DESIGNER";
          publicId?: string | null;
          username?: string | null;
        };
        session.user.id = t.sub ?? "";
        session.user.role = t.role ?? "DESIGNER";
        session.user.publicId = t.publicId ?? null;
        session.user.username = t.username ?? null;
      }
      return session;
    },
  },
});
