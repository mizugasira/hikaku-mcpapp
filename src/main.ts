import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

async function startHttp() {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  // MCP_PATH_TOKEN を設定すると /mcp/<token> でのみ受け付ける (URL を知っている人だけが使える簡易保護)
  const mcpPath = process.env.MCP_PATH_TOKEN ? `/mcp/${process.env.MCP_PATH_TOKEN}` : "/mcp";

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.all(mcpPath, async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  const httpServer = app.listen(port, (err?: Error) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log(`MCP server listening on http://localhost:${port}${process.env.MCP_PATH_TOKEN ? "/mcp/<token>" : "/mcp"}`);
  });
  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv.includes("--stdio")) {
  await createServer().connect(new StdioServerTransport());
} else {
  await startHttp();
}
