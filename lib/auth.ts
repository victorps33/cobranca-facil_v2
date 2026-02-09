import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const ALLOWED_GOOGLE_DOMAIN = "menlopagamentos.com.br";

const providers: Provider[] = [];

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

if (googleEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

providers.push(
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user || !user.password) return null;

      const isValid = await verifyPassword(credentials.password, user.password);
      if (!isValid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        franqueadoraId: user.franqueadoraId,
      };
    },
  })
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/login", error: "/auth/login" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: only allow @menlopagamentos.com.br emails
      if (account?.provider === "google") {
        const email = user.email;
        if (!email?.endsWith(`@${ALLOWED_GOOGLE_DOMAIN}`)) {
          return false;
        }

        // Auto-provision: find or create user in DB
        let dbUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!dbUser) {
          const franqueadora = await prisma.franqueadora.findFirst();
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              role: "VISUALIZADOR",
              franqueadoraId: franqueadora?.id ?? null,
            },
          });
        }

        // Inject DB data into user object so jwt callback can read it
        user.id = dbUser.id;
        user.role = dbUser.role;
        user.franqueadoraId = dbUser.franqueadoraId;
      }

      return true;
    },
    async jwt({ token, user }) {
      // On initial sign-in, populate the token with user data
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.franqueadoraId = user.franqueadoraId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.franqueadoraId = token.franqueadoraId;
      }
      return session;
    },
  },
};
