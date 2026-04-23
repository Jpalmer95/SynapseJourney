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

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
