import type { Product, Provider, SearchOptions } from "./types.js";

// DEMO_MODE=1 のときだけ有効になる、API キー無しで UI を確認するためのダミーデータ
export const demo: Provider = {
  id: "demo",
  name: "デモストア",
  setupHint: "DEMO_MODE=1 で有効化",
  isConfigured: () => process.env.DEMO_MODE === "1",

  async search(opts: SearchOptions): Promise<Product[]> {
    const shops = ["デモ楽天風ショップ", "デモYahoo風ショップ", "デモ家電館"];
    let seed = [...opts.query].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const base = 1000 + Math.floor(rand() * 20000);
    return Array.from({ length: Math.min(opts.limit, 6) }, (_, i) => ({
      source: "demo",
      sourceName: "デモストア",
      title: `${opts.query} サンプル商品 ${i + 1}`,
      price: Math.round(base * (0.8 + rand() * 0.6)),
      url: `https://example.com/item/${encodeURIComponent(opts.query)}/${i + 1}`,
      shopName: shops[i % shops.length],
      reviewAverage: Math.round((3 + rand() * 2) * 10) / 10,
      reviewCount: Math.floor(rand() * 500),
      freeShipping: rand() > 0.5,
    })).filter(
      (p) => (opts.minPrice == null || p.price >= opts.minPrice) && (opts.maxPrice == null || p.price <= opts.maxPrice),
    );
  },
};
