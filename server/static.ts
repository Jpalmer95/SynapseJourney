import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Try multiple possible build output paths
  const possiblePaths = [
    path.resolve(__dirname, "..", "dist", "public"),  // built dist
    path.resolve(__dirname, "public"),                  // source dev
    path.resolve(process.cwd(), "dist", "public"),      // cwd fallback
  ];

  const distPath = possiblePaths.find((p) => fs.existsSync(p));

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Tried: ${possiblePaths.join(", ")}. Make sure to build the client first.`,
    );
  }

  app.use(express.static(distPath));

  // Client-side routes that the SPA owns. Anything else is a genuine 404: serve the app
  // shell (so the branded NotFound page renders) but with an honest status code — the old
  // fallback answered 200 for every unknown URL, a soft 404 for crawlers and analytics.
  const spaRoutes = [
    /^\/$/,
    /^\/(map|saved|profile|settings|pathways|achievements|explore|rabbit-hole|collection|open-science)(\/|$)/,
    /^\/pathway\/[^/]+\/?$/,
    /^\/practice-test\/[^/]+(\/results\/[^/]+)?\/?$/,
    /^\/reset-password(\/|$)/,
  ];

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const pathname = req.originalUrl.split("?")[0];
    // Unknown API routes must answer JSON, never the HTML shell.
    if (pathname.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }

    const isSpaRoute = spaRoutes.some((re) => re.test(pathname));
    if (!isSpaRoute && !pathname.includes(".")) {
      res.status(404);
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
