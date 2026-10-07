import { demo } from "./demo.js";
import { rakuten } from "./rakuten.js";
import type { Product, ProviderResult, SearchOptions } from "./types.js";
import { yahoo } from "./yahoo.js";

export * from "./types.js";

const PROVIDERS = [rakuten, yahoo, demo];
const TIMEOUT_MS = 10_000;

/** API を持たないサービスは検索結果ページへのリンクで補完する */
export function searchLinks(query: string) {
  const q = encodeURIComponent(query);
  return [
    { name: "Amazon", url: `https://www.amazon.co.jp/s?k=${q}` },
    { name: "価格.com", url: `https://search.kakaku.com/${q}/` },
    { name: "楽天市場", url: `https://search.rakuten.co.jp/search/mall/${q}/` },
    { name: "Yahoo!ショッピング", url: `https://shopping.yahoo.co.jp/search?p=${q}` },
    { name: "メルカリ", url: `https://jp.mercari.com/search?keyword=${q}` },
  ];
}

export async function searchAll(opts: SearchOptions): Promise<{
  items: Product[];
  providers: ProviderResult[];
}> {
  const active = PROVIDERS.filter((p) => p.id !== "demo" || p.isConfigured());
  const providers = await Promise.all(
    active.map(async (p): Promise<ProviderResult> => {
      const base = { source: p.id, sourceName: p.name };
      if (!p.isConfigured()) {
        return { ...base, status: "not_configured", message: p.setupHint, items: [] };
      }
      try {
        const items = await p.search(opts, AbortSignal.timeout(TIMEOUT_MS));
        return { ...base, status: "ok", items: items.filter((i) => Number.isFinite(i.price) && i.price > 0) };
      } catch (e) {
        return { ...base, status: "error", message: e instanceof Error ? e.message : String(e), items: [] };
      }
    }),
  );
  const items = providers.flatMap((p) => p.items).sort((a, b) => a.price - b.price);
  return { items, providers };
}
