import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/auth-schema";

export type AuthEnvironment = {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};
export function authConfigured(env: AuthEnvironment) {
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET ||
      !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || !env.BETTER_AUTH_URL) return false;
  try {
    const url = new URL(env.BETTER_AUTH_URL);
    return url.pathname === "/" && !url.search && !url.hash &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch { return false; }
}
export function createCustomerAuth(env: AuthEnvironment) {
  if (!authConfigured(env)) throw new Error("Google sign-in is not configured.");
  return betterAuth({
    appName: "KS Distribuidora",
    baseURL: env.BETTER_AUTH_URL!,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET!,
    trustedOrigins: [new URL(env.BETTER_AUTH_URL!).origin],
    database: drizzleAdapter(drizzle(env.DB!, { schema }), {
      provider: "sqlite", schema, transaction: false,
    }),
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" },
    },
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] }, cookiePrefix: "ks-customer", useSecureCookies: new URL(env.BETTER_AUTH_URL!).protocol === "https:" },
  });
}
