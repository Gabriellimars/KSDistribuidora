import { env } from "cloudflare:workers";
import { authConfigured, createCustomerAuth } from "./customer-auth";
export async function getCustomer(req: Request) {
  if (!authConfigured(env)) return null;
  const session = await createCustomerAuth(env).api.getSession({ headers: req.headers });
  if (!session?.user || !session.user.emailVerified) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
export const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export function sameOrigin(req: Request) {
  return req.headers.get("origin") === new URL(req.url).origin &&
    req.headers.get("sec-fetch-site") !== "cross-site";
}
