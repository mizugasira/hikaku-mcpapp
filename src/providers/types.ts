export interface Product {
  /** ショップ識別子 (rakuten / yahoo / demo) */
  source: string;
  /** 表示用サービス名 */
  sourceName: string;
  title: string;
  /** 税込価格 (円) */
  price: number;
  url: string;
  imageUrl?: string;
  shopName?: string;
  reviewAverage?: number;
  reviewCount?: number;
  freeShipping?: boolean;
}

export interface SearchOptions {
  query: string;
  limit: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProviderResult {
  source: string;
  sourceName: string;
  status: "ok" | "error" | "not_configured";
  message?: string;
  items: Product[];
}

export interface Provider {
  id: string;
  name: string;
  isConfigured(): boolean;
  /** 未設定時に表示する案内 */
  setupHint: string;
  search(opts: SearchOptions, signal: AbortSignal): Promise<Product[]>;
}
