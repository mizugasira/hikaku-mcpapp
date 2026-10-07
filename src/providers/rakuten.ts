import type { Product, Provider, SearchOptions } from "./types.js";

// 楽天ウェブサービス 商品検索API
// 2026年5月に旧エンドポイント (app.rakuten.co.jp) が終了し、
// openapi.rakuten.co.jp + applicationId + accessKey (+ 登録済みドメインの Referer) が必須になった。
const DEFAULT_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601";

type RakutenItem = {
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl?: string;
  shopName?: string;
  reviewAverage?: number;
  reviewCount?: number;
  postageFlag?: number; // 0: 送料込み, 1: 送料別
  mediumImageUrls?: (string | { imageUrl: string })[];
};

export const rakuten: Provider = {
  id: "rakuten",
  name: "楽天市場",
  setupHint: "環境変数 RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定してください",
  isConfigured: () => !!process.env.RAKUTEN_APP_ID && !!process.env.RAKUTEN_ACCESS_KEY,

  async search(opts: SearchOptions, signal: AbortSignal): Promise<Product[]> {
    const params = new URLSearchParams({
      format: "json",
      formatVersion: "2",
      keyword: opts.query,
      hits: String(Math.min(opts.limit, 30)),
      sort: "+itemPrice",
      availability: "1",
      applicationId: process.env.RAKUTEN_APP_ID!,
      accessKey: process.env.RAKUTEN_ACCESS_KEY!,
    });
    if (process.env.RAKUTEN_AFFILIATE_ID) params.set("affiliateId", process.env.RAKUTEN_AFFILIATE_ID);
    if (opts.minPrice != null) params.set("minPrice", String(opts.minPrice));
    if (opts.maxPrice != null) params.set("maxPrice", String(opts.maxPrice));

    const headers: Record<string, string> = {};
    const referer = process.env.RAKUTEN_REFERER ?? process.env.PUBLIC_URL;
    if (referer) {
      headers.Referer = referer;
      headers.Origin = new URL(referer).origin;
    }

    const endpoint = process.env.RAKUTEN_ENDPOINT ?? DEFAULT_ENDPOINT;
    const res = await fetch(`${endpoint}?${params}`, { headers, signal });
    const body = (await res.json().catch(() => ({}))) as {
      Items?: (RakutenItem | { Item: RakutenItem })[];
      error?: string;
      error_description?: string;
      errors?: { errorMessage?: string };
    };
    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: ${body.error_description ?? body.errors?.errorMessage ?? body.error ?? "unknown error"}`,
      );
    }

    return (body.Items ?? []).map((raw) => {
      const it = "Item" in raw ? raw.Item : raw;
      const img = it.mediumImageUrls?.[0];
      return {
        source: "rakuten",
        sourceName: "楽天市場",
        title: it.itemName,
        price: Number(it.itemPrice),
        url: it.affiliateUrl || it.itemUrl,
        imageUrl: typeof img === "string" ? img : img?.imageUrl,
        shopName: it.shopName,
        reviewAverage: it.reviewAverage,
        reviewCount: it.reviewCount,
        freeShipping: it.postageFlag === 0,
      };
    });
  },
};
