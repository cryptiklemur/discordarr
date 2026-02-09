import { createServer, type Server } from "node:http";
import type { Client } from "discord.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { handleAuthCallback } from "./overseerr-auth.js";

let server: Server | null = null;

export function startAuthServer(client: Client): void {
  const logger = getLogger();
  const config = loadConfig();

  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", config.PUBLIC_URL);

    if (req.method === "GET" && url.pathname === "/auth/callback") {
      const result = await handleAuthCallback(url);
      res.writeHead(result.status, { "Content-Type": "text/html" });
      res.end(result.body);
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", bot: client.user?.tag }));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(3000, () => {
    logger.info({ port: 3000 }, "Auth HTTP server listening");
  });
}

export function stopAuthServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
