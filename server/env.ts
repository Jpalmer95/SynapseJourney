/**
 * Minimal .env loader — imported first by server/index.ts.
 *
 * Why this exists: the app used to inherit its environment entirely from the
 * shell that started pm2. Adding a variable to .env and running
 * `pm2 restart --update-env` (without sourcing .env) silently left it unset, which
 * is how password-reset email stayed dead while the file "looked" configured.
 *
 * Rules:
 *  - values already present in process.env win (explicit env > file)
 *  - supports KEY=value, KEY="value with spaces <angle>", # comments, blank lines
 *  - never throws: a missing/unreadable .env is not fatal
 */
import fs from "node:fs";
import path from "node:path";

function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function load(): void {
  // __dirname exists in the esbuild CJS bundle but not under tsx/ESM.
  const here = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(here, "..", ".env"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = parseEnv(fs.readFileSync(file, "utf8"));
      let loaded = 0;
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
          loaded++;
        }
      }
      if (loaded > 0) console.log(`[env] loaded ${loaded} variable(s) from ${file}`);
      return;
    } catch (err: any) {
      console.warn(`[env] could not read ${file}: ${err?.message || err}`);
    }
  }
}

load();
