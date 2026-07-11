import { createCookie } from "remix/cookie";

import { DEFAULT_THEME, getTheme, type Theme } from "../ui/themes.ts";

// The theme is a low-stakes display preference the browser is allowed to carry,
// so a plain (unsigned) cookie is the right fit rather than a session.
export const themeCookie = createCookie("theme", {
  path: "/",
  sameSite: "Lax",
  maxAge: 60 * 60 * 24 * 365, // 1 year
});

// Resolves the theme for a request from its cookie, falling back to the default.
export async function readTheme(request: Request): Promise<Theme> {
  let raw = await themeCookie.parse(request.headers.get("cookie"));
  return getTheme(typeof raw === "string" ? raw : DEFAULT_THEME);
}
