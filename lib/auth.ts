import { randomBytes } from "crypto";
import { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAllowedEmailDomain } from "@/lib/validation";

const AZURE_AD_ID = "azure-ad";

// Microsoft 365 sign-in is only offered when the Entra ID app is configured.
// The login page asks next-auth which providers exist before showing the button.
const microsoftProvider: Provider[] =
  process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID
    ? [
        AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          tenantId: process.env.AZURE_AD_TENANT_ID,
          // Skip the default Graph photo fetch: it would put a base64 image in the JWT cookie.
          // Work accounts don't always send `email`; preferred_username is the UPN.
          profile(profile) {
            return {
              id: profile.sub,
              name: profile.name,
              email: (profile.email || profile.preferred_username || "").toLowerCase(),
            };
          },
        }),
      ]
    : [];

/**
 * Microsoft 365 users are matched to a local account by email and created on
 * first sign-in (role USER). The password column is required, so SSO-only
 * accounts get a random hash nobody knows.
 */
async function findOrCreateSsoUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const password = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  return prisma.user.create({
    data: { email, name: name || email.split("@")[0], password, role: "USER" },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Same error for unknown email, wrong password and disabled account
        // so the login form can't be used to probe which emails exist.
        const passwordMatch =
          !!user && (await bcrypt.compare(credentials.password, user.password));

        if (!user || !passwordMatch || user.active === false) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    ...microsoftProvider,
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== AZURE_AD_ID) return true;

      const email = user.email;
      if (!email || !isAllowedEmailDomain(email)) return false;

      const dbUser = await findOrCreateSsoUser(email, user.name ?? "");
      return dbUser.active !== false;
    },
    async jwt({ token, user, account }) {
      // The Microsoft profile id is not our user id; swap in the local account.
      if (user && account?.provider === AZURE_AD_ID) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser || dbUser.active === false) return {} as typeof token;
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.name = dbUser.name;
        token.email = dbUser.email;
        return token;
      }

      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        return token;
      }

      // Re-read role/active on every request so role changes and disabled
      // accounts take effect without waiting for the JWT to expire.
      if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (!current || current.active === false) return {} as typeof token;
        token.role = current.role;
        token.name = current.name;
        token.email = current.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Disabled/deleted account: the jwt callback cleared the token.
      if (!token.id) {
        return { ...session, user: undefined } as any;
      }
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    // OAuth failures (e.g. Microsoft account outside the allowed domains) come back to the login form.
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
};
