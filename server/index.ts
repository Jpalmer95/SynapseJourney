import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedQuestionBank } from "./seedQuestionBank";
import { populateMissingLessonUnits, regeneratePlaceholderContent } from "./populateLessonUnits";

// Prevent Gradio/WebSocket library errors from crashing the server process
process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[Server] Unhandled rejection (suppressed to prevent crash):", msg);
});
process.on("uncaughtException", (err: Error) => {
  console.error("[Server] Uncaught exception (suppressed):", err.message);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Default JSON limit (100kb) for most routes
app.use((req, res, next) => {
  if (req.path === "/api/tts/voice-upload") {
    // Allow up to 8MB for base64 voice reference audio uploads (~5MB binary = ~6.7MB base64)
    express.json({ limit: "8mb" })(req, res, next);
  } else {
    express.json({
      verify: (req: any, _res: any, buf: any) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Exclude large binary fields (e.g. base64 audio) from log output
        const loggable = { ...capturedJsonResponse };
        if (loggable.audioData) loggable.audioData = `[base64 ~${Math.round((loggable.audioData.length * 3) / 4 / 1024)}KB]`;
        logLine += ` :: ${JSON.stringify(loggable)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Seed question bank with sample questions
  await seedQuestionBank();
  
  // Populate missing lesson units for topics that don't have any
  await populateMissingLessonUnits();
  
  // Check for and clear any placeholder content so it can be regenerated
  await regeneratePlaceholderContent();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
