import { createAssetServer } from "remix/assets";

const rootDir = process.cwd();

export const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir,
  fileMap: {
    "app/*path": "app/*path",
    "node_modules/*path": "node_modules/*path",
  },
  // The deterministic engine under app/game is imported by the play and replay
  // client entries, so it must be browser-reachable too. format.ts (time
  // display) and ui/themes.ts (client-side theme switching, pure data) are the
  // only other app modules pulled into the browser bundle; the rest of
  // app/utils (passwords, redirects) stays server-only.
  allow: [
    "app/assets/**",
    "app/game/**",
    "app/utils/format.ts",
    "app/utils/icons.tsx",
    "app/ui/themes.ts",
    "node_modules/**",
  ],
  deny: ["app/**/*.server.*"],
  sourceMaps: process.env.NODE_ENV === "development" ? "external" : undefined,
  scripts: {
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
    },
  },
});
