import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult, type ReadResourceResult } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { searchAll, searchLinks } from "./providers/index.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UI_HTML = path.join(ROOT_DIR, "dist", "ui", "mcp-app.html");
const RESOURCE_URI = "ui://price-compare/mcp-app.html";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export function createServer(): McpServer {
  const server = new McpServer({ name: "hikaku-mcpapp", version: "1.0.0" });

  registerAppTool(
    server,
    "compare-prices",
    {
      title: "価格比較",
      description:
        "ユーザーが指定した商品を楽天市場・Yahoo!ショッピングなど複数のショッピングサービスで検索し、" +
        "価格の安い順に並べて比較する。結果は対話的な比較表として表示される。",
      inputSchema: z.object({
        query: z.string().min(1).describe("検索する商品名やキーワード (例: 'AirPods Pro 第2世代')"),
        limit: z.number().int().min(1).max(30).default(10).describe("各サービスから取得する最大件数"),
        minPrice: z.number().int().min(0).optional().describe("最低価格 (円)"),
        maxPrice: z.number().int().min(0).optional().describe("最高価格 (円)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ query, limit, minPrice, maxPrice }): Promise<CallToolResult> => {
      const { items, providers } = await searchAll({ query, limit: limit ?? 10, minPrice, maxPrice });
      const links = searchLinks(query);

      const lines = [`「${query}」の価格比較 (${items.length}件, 安い順)`];
      for (const it of items.slice(0, 10)) {
        lines.push(`- ${yen(it.price)} [${it.sourceName}${it.shopName ? ` / ${it.shopName}` : ""}] ${it.title} ${it.url}`);
      }
      for (const p of providers.filter((p) => p.status !== "ok")) {
        lines.push(`※ ${p.sourceName}: ${p.status === "not_configured" ? "未設定" : "エラー"} (${p.message})`);
      }
      lines.push(`その他の検索リンク: ${links.map((l) => `${l.name} ${l.url}`).join(" / ")}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          query,
          searchedAt: new Date().toISOString(),
          items,
          providers: providers.map(({ items, ...rest }) => ({ ...rest, count: items.length })),
          links,
        },
      };
    },
  );

  registerAppResource(
    server,
    "価格比較ビュー",
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE, description: "価格比較結果のインタラクティブ表示" },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(UI_HTML, "utf-8");
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            // 商品画像を表示するため、ショップの画像 CDN を許可する
            _meta: {
              ui: {
                csp: {
                  resourceDomains: [
                    "https://thumbnail.image.rakuten.co.jp",
                    "https://item-shopping.c.yimg.jp",
                    "https://shopping.c.yimg.jp",
                  ],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}
