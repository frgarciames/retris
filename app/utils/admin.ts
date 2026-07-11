const isProd = process.env.NODE_ENV === "production";

const configuredAdmin = process.env.ADMIN_USERNAME?.trim();
if (!configuredAdmin && isProd) {
  throw new Error("ADMIN_USERNAME is required in production");
}

export const ADMIN_USERNAME = configuredAdmin || "admin@example.test";

export function isAdmin(user: { username: string } | null | undefined): boolean {
  return user?.username === ADMIN_USERNAME;
}
