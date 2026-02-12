import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createDefaultDunningRule } from "@/lib/default-dunning-rule";

// Optional: restrict Google OAuth to specific domains via env var
// Example: ALLOWED_GOOGLE_DOMAINS=menlopagamentos.com.br,gmail.com
const ALLOWED_GOOGLE_DOMAINS = process.env.ALLOWED_GOOGLE_DOMAINS
  ? process.env.ALLOWED_GOOGLE_DOMAINS.split(",").map((d) => d.trim())
  : null; // null = allow all domains

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
        where: { email: credentials.email.toLowerCase() },
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
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
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
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        // Optional domain restriction
        if (ALLOWED_GOOGLE_DOMAINS) {
          const domain = email.split("@")[1];
          if (!domain || !ALLOWED_GOOGLE_DOMAINS.includes(domain)) {
            return false;
          }
        }

        // Auto-provision: find or create user in DB
        let dbUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!dbUser) {
          // Create Franqueadora + User + Default Dunning Rule in a transaction
          dbUser = await prisma.$transaction(async (tx) => {
            const franqueadora = await tx.franqueadora.create({
              data: {
                nome: user.name || "Minha Empresa",
                razaoSocial: user.name || "Minha Empresa",
                email,
              },
            });

            const newUser = await tx.user.create({
              data: {
                email,
                name: user.name,
                image: user.image,
                role: "ADMINISTRADOR",
                franqueadoraId: franqueadora.id,
              },
            });

            await createDefaultDunningRule(tx, franqueadora.id);

            return newUser;
          });
        }

        // Inject DB data into user object so jwt callback can read it
        user.id = dbUser.id;
        user.role = dbUser.role;
        user.franqueadoraId = dbUser.franqueadoraId;
        user.onboardingCompletedAt = dbUser.onboardingCompletedAt?.toISOString() ?? null;
      }

      return true;
    },
    async jwt({ token, user }) {
      // On initial sign-in, populate the token with user data
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.franqueadoraId = user.franqueadoraId;
        token.onboardingCompletedAt = user.onboardingCompletedAt;
      }

      // Se franqueadoraId ainda é null, verificar no banco (pode ter sido associada após login)
      if (!token.franqueadoraId && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { franqueadoraId: true, onboardingCompletedAt: true },
        });
        if (dbUser?.franqueadoraId) {
          token.franqueadoraId = dbUser.franqueadoraId;
        }
        if (dbUser?.onboardingCompletedAt) {
          token.onboardingCompletedAt = dbUser.onboardingCompletedAt.toISOString();
        }
      }

      // Re-fetch onboardingCompletedAt if null (may have been completed after login)
      if (!token.onboardingCompletedAt && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { onboardingCompletedAt: true },
        });
        if (dbUser?.onboardingCompletedAt) {
          token.onboardingCompletedAt = dbUser.onboardingCompletedAt.toISOString();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.franqueadoraId = token.franqueadoraId;
        session.user.onboardingCompletedAt = token.onboardingCompletedAt;
      }
      return session;
    },
  },
};
