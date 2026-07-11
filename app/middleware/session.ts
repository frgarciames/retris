import { createCookie } from "remix/cookie";
import { createFsSessionStorage } from "remix/session-storage/fs";
import { createMemorySessionStorage } from "remix/session-storage/memory";

const isTest = process.env.NODE_ENV === "test";
const isProd = process.env.NODE_ENV === "production";

const secret = process.env.SESSION_SECRET;
// Production must supply a real secret and fails fast without one. Development
// and tests fall back to an insecure value so the app runs out of the box.
if (!secret && isProd) {
  throw new Error("SESSION_SECRET is required in production");
}
if (!secret && !isTest) {
  console.warn("SESSION_SECRET is not set — using an insecure development secret.");
}

export const sessionCookie = createCookie("session", {
  secrets: [secret ?? "insecure-dev-secret"],
  httpOnly: true,
  sameSite: "Lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: "/",
});

// Memory storage keeps tests isolated and avoids touching tmp/; the filesystem
// store is fine for this single-process app in development and production.
export const sessionStorage = isTest
  ? createMemorySessionStorage()
  : createFsSessionStorage("./tmp/sessions");

// Shape of the auth value persisted in the session.
export interface SessionAuth {
  userId: number;
}
