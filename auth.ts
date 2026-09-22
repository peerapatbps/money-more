import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL ?? "";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ profile }) {
      if (!ALLOWED_EMAIL) return true; // no restriction configured yet
      return profile?.email === ALLOWED_EMAIL;
    },
  },
  pages: {
    signIn: "/login",
  },
});
