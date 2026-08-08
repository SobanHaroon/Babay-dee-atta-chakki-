import "dotenv/config";
import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./api/index.js";

const PORT = 3000;

async function startServer() {
  app.use(compression());

  // The supplied public/favicon.ico is the current brand JPEG stored under the
  // legacy .ico filename. Serve the matching MIME type so browsers and PWA
  // clients decode the asset consistently in development and production.
  app.get("/favicon.ico", (_req, res) => {
    res.type("image/jpeg");
    res.sendFile(path.join(process.cwd(), "public", "favicon.ico"));
  });

  // Vite development middleware vs production static setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Babay Dee Atta Chakki serving on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server bootstrap error:", err);
});
