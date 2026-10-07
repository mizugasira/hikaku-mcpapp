import type { Product, Provider, SearchOptions } from "./types.js";

// Yahoo!ショッピング 商品検索API (V3)
const DEFAULT_ENDPOINT = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";

type YahooHit = {
  name: string;
  price: number;
  url: string;
  image?: { small?: string; medium?: string };
  seller?: { name?: string };
  review?: { rate?: number; count?: number };
  shipping?: { code?: number }; // 2: 送料無料
};

export const yahoo: Provider = {
  id: "yahoo",
  name: "Yahoo!ショッピング",
  setupHint: "環境変数 YAHOO_APP_ID (Yahoo!デベロッパーネットワークの Client ID) を設定してください",
  isConfigured: () => !!process.env.YAHOO_APP_ID,

  async search(opts: SearchOptions, signal: AbortSignal): Promise<Product[]> {
    const params = new URLSearchParams({
      appid: process.env.YAHOO_APP_ID!,
      query: opts.query,
      results: String(Math.min(opts.limit, 50)),
      sort: "+price",
      in_stock: "true",
    });
    if (process.env.YAHOO_AFFILIATE_ID) {
      params.set("affiliate_type", "vc");
      params.set("affiliate_id", process.env.YAHOO_AFFILIATE_ID);
    }
    if (opts.minPrice != null) params.set("price_from", String(opts.minPrice));
    if (opts.maxPrice != null) params.set("price_to", String(opts.maxPrice));

    const endpoint = process.env.YAHOO_ENDPOINT ?? DEFAULT_ENDPOINT;
    const res = await fetch(`${endpoint}?${params}`, { signal });
    const body = (await res.json().catch(() => ({}))) as {
      hits?: YahooHit[];
      Error?: { Message?: string };
    };
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.Error?.Message ?? "unknown error"}`);

    return (body.hits ?? []).map((h) => ({
      source: "yahoo",
      sourceName: "Yahoo!ショッピング",
      title: h.name,
      price: Number(h.price),
      url: h.url,
      imageUrl: h.image?.medium ?? h.image?.small,
      shopName: h.seller?.name,
      reviewAverage: h.review?.rate,
      reviewCount: h.review?.count,
      freeShipping: h.shipping?.code === 2,
    }));
  },
};
