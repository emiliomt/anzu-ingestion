import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) return null;
        const { email, password } = credentials as { email: string; password: string };
        if (safeEqual(email, adminEmail) && safeEqual(password, adminPassword)) {
          return { id: "admin", email: adminEmail, name: "Admin" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
