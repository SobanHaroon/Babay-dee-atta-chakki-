import "dotenv/config";
import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./api/index.js";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  app.use(compression());

  // Vite development middleware vs production static setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist/client");
    app.use(express.static(distPath, {
      dotfiles: "deny",
      maxAge: "1d",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      }
    }));
    app.get("*", (req, res) => {
      if (req.path !== "/" && req.path !== "/index.html") return res.status(404).send("Page not found");
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
