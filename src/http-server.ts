import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Express, Request, Response } from "express";
import { InMemoryEventStore } from "./in-memory-event-store.js";
import { setupServer } from "./mcp-server.js";
import { runWithMonobankTokenAsync } from "./request-context.js";

function parseBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const t = authorization.slice("Bearer ".length).trim();
  return t || undefined;
}

function monobankTokenFromHttp(req: IncomingMessage): string | undefined {
  const raw = req.headers["authorization"];
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  const bearer = parseBearerToken(authorization);
  if (bearer) return bearer;

  const mono = req.headers["x-monobank-token"];
  const monoStr = Array.isArray(mono) ? mono[0] : mono;
  const trimmed = monoStr?.trim();
  return trimmed || undefined;
}

/** Shared transports by MCP session id (Streamable HTTP stateful mode). */
const transports: Record<string, StreamableHTTPServerTransport> = {};

function attachClose(transport: StreamableHTTPServerTransport): void {
  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid && transports[sid]) {
      delete transports[sid];
    }
  };
}

export function createMonobankMcpHttpApp(options?: {
  host?: string;
  allowedHosts?: string[];
}): Express {
  const app = createMcpExpressApp(options);

  const mcpPostHandler = async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    try {
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && req.body && isInitializeRequest(req.body)) {
        const eventStore = new InMemoryEventStore();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (sid) => {
            transports[sid] = transport!;
          },
        });
        attachClose(transport);

        const token = monobankTokenFromHttp(req);
        await runWithMonobankTokenAsync(token, async () => {
          const server = setupServer();
          await server.connect(transport!);
          await transport!.handleRequest(req, res, req.body);
          res.on("close", () => {
            void transport!.close();
            void server.close();
          });
        });
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      const token = monobankTokenFromHttp(req);
      await runWithMonobankTokenAsync(token, async () => {
        await transport.handleRequest(req, res, req.body);
      });
    } catch (error) {
      console.error("Error handling MCP POST:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  };

  const mcpGetHandler = async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    const token = monobankTokenFromHttp(req);

    try {
      await runWithMonobankTokenAsync(token, async () => {
        await transport.handleRequest(req, res);
      });
    } catch (error) {
      console.error("Error handling MCP GET:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing MCP GET");
      }
    }
  };

  const mcpDeleteHandler = async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionHeader === "string"
        ? sessionHeader
        : Array.isArray(sessionHeader)
          ? sessionHeader[0]
          : undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    const token = monobankTokenFromHttp(req);

    try {
      await runWithMonobankTokenAsync(token, async () => {
        await transport.handleRequest(req, res);
      });
    } catch (error) {
      console.error("Error handling MCP DELETE:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  app.post("/mcp", mcpPostHandler);
  app.get("/mcp", mcpGetHandler);
  app.delete("/mcp", mcpDeleteHandler);

  return app;
}

export function startMonobankMcpHttpServer(port: number, listenHost = "0.0.0.0"): void {
  const app = createMonobankMcpHttpApp({ host: listenHost });

  const server = createServer(app as unknown as (req: IncomingMessage, res: ServerResponse) => void);
  server.listen(port, listenHost, () => {
    console.error(`Monobank MCP HTTP listening on http://${listenHost}:${port}/mcp`);
  });
}
