import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";
import "./mcp-app.css";

type Product = {
  source: string;
  sourceName: string;
  title: string;
  price: number;
  url: string;
  imageUrl?: string;
  shopName?: string;
  reviewAverage?: number;
  reviewCount?: number;
  freeShipping?: boolean;
};
type ProviderStatus = {
  source: string;
  sourceName: string;
  status: "ok" | "error" | "not_configured";
  message?: string;
  count: number;
};
type CompareResult = {
  query: string;
  items: Product[];
  providers: ProviderStatus[];
  links: { name: string; url: string }[];
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("search-form");
const qEl = $<HTMLInputElement>("q");
const minEl = $<HTMLInputElement>("min");
const maxEl = $<HTMLInputElement>("max");
const btn = $<HTMLButtonElement>("search-btn");
const statusEl = $("status");
const resultsEl = $("results");
const summaryEl = $("summary");
const toolbarEl = $("toolbar");
const filtersEl = $("filters");
const sortEl = $<HTMLSelectElement>("sort");
const linksEl = $("links");

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

let data: CompareResult | null = null;
const hidden = new Set<string>();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

function setStatus(text: string, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", error);
  statusEl.hidden = !text;
}

function render() {
  resultsEl.replaceChildren();
  if (!data) return;

  // サービスごとのフィルター (未設定/エラーは理由をツールチップで表示)
  filtersEl.replaceChildren(
    ...data.providers.map((p) => {
      if (p.status !== "ok") {
        return el("span", {
          className: "chip warn",
          title: p.message ?? "",
          textContent: `${p.sourceName}: ${p.status === "not_configured" ? "未設定" : "エラー"}`,
        });
      }
      const chip = el("button", { type: "button", className: "chip", textContent: `${p.sourceName} (${p.count})` });
      chip.setAttribute("aria-pressed", String(!hidden.has(p.source)));
      chip.onclick = () => {
        hidden.has(p.source) ? hidden.delete(p.source) : hidden.add(p.source);
        render();
      };
      return chip;
    }),
  );

  const items = data.items.filter((i) => !hidden.has(i.source));
  const sort = sortEl.value;
  items.sort((a, b) =>
    sort === "price-desc" ? b.price - a.price
    : sort === "review" ? (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
    : a.price - b.price,
  );

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const min = prices[0];
  toolbarEl.hidden = false;
  summaryEl.hidden = prices.length === 0;
  if (prices.length) {
    $("s-min").textContent = yen(min);
    $("s-med").textContent = yen(prices[Math.floor(prices.length / 2)]);
    $("s-max").textContent = yen(prices[prices.length - 1]);
    $("s-count").textContent = `${prices.length}件`;
  }

  if (!items.length) {
    setStatus(
      data.providers.some((p) => p.status === "ok")
        ? `「${data.query}」に一致する商品が見つかりませんでした。`
        : "検索可能なショッピングサービスがありません。サーバーの API キー設定を確認してください。",
      !data.providers.some((p) => p.status === "ok"),
    );
  } else {
    setStatus("");
  }

  for (const it of items) {
    const isBest = it.price === min;
    const meta = el("div", { className: "meta" },
      el("span", { className: `badge ${it.source}`, textContent: it.sourceName }),
      ...(isBest ? [el("span", { className: "badge best", textContent: "最安" })] : []),
      ...(it.freeShipping ? [el("span", { className: "badge ship", textContent: "送料無料" })] : []),
      ...(it.shopName ? [el("span", { textContent: it.shopName })] : []),
      ...(it.reviewCount ? [el("span", { textContent: `★${(it.reviewAverage ?? 0).toFixed(1)} (${it.reviewCount})` })] : []),
    );
    const open = el("button", { type: "button", className: "open", textContent: "ショップで見る" });
    open.onclick = () => openUrl(it.url);
    const thumb = el("img", { className: "thumb", alt: "", loading: "lazy", referrerPolicy: "no-referrer" });
    if (it.imageUrl) thumb.src = it.imageUrl;
    else thumb.style.visibility = "hidden";

    resultsEl.append(
      el("li", { className: `item${isBest ? " best" : ""}` },
        thumb,
        el("div", { className: "info" }, el("div", { className: "title", title: it.title, textContent: it.title }), meta),
        el("div", { className: "price-col" },
          el("span", { className: "price", textContent: yen(it.price) }),
          el("span", { className: "diff", textContent: isBest ? "" : `+${yen(it.price - min)}` }),
          open,
        ),
      ),
    );
  }

  linksEl.hidden = !data.links.length;
  linksEl.replaceChildren(
    "他のサービスで探す:",
    ...data.links.map((l) => {
      const a = el("a", { href: l.url, textContent: l.name });
      a.onclick = (e) => { e.preventDefault(); openUrl(l.url); };
      return a;
    }),
  );
}

async function openUrl(url: string) {
  const res = await app.openLink({ url }).catch(() => ({ isError: true }));
  if (res.isError) window.open(url, "_blank", "noopener");
}

function applyResult(result: CallToolResult) {
  const sc = result.structuredContent as CompareResult | undefined;
  if (result.isError || !sc) {
    const text = result.content?.find((c) => c.type === "text");
    setStatus(text && "text" in text ? text.text : "検索に失敗しました。", true);
    return;
  }
  data = sc;
  hidden.clear();
  qEl.value = sc.query;
  render();
}

function handleHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

const app = new App({ name: "価格比較", version: "1.0.0" });

app.ontoolinput = ({ arguments: args }) => {
  const a = (args ?? {}) as { query?: string; minPrice?: number; maxPrice?: number };
  if (a.query) qEl.value = a.query;
  minEl.value = a.minPrice != null ? String(a.minPrice) : "";
  maxEl.value = a.maxPrice != null ? String(a.maxPrice) : "";
  setStatus(`「${a.query ?? ""}」を各ショップで検索中…`);
};
app.ontoolresult = applyResult;
app.ontoolcancelled = () => setStatus("検索がキャンセルされました。", true);
app.onhostcontextchanged = handleHostContext;
app.onerror = console.error;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = qEl.value.trim();
  if (!query) return;
  const args: Record<string, unknown> = { query };
  if (minEl.value) args.minPrice = Number(minEl.value);
  if (maxEl.value) args.maxPrice = Number(maxEl.value);

  btn.disabled = true;
  setStatus(`「${query}」を各ショップで検索中…`);
  try {
    const result = await app.callServerTool({ name: "compare-prices", arguments: args });
    applyResult(result);
    // UI から行った再検索の結果を Claude にも共有する
    if (data && !result.isError) {
      const top = data.items.slice(0, 5).map((i) => `${yen(i.price)} ${i.sourceName} ${i.title}`).join("\n");
      await app.updateModelContext({
        content: [{ type: "text", text: `ユーザーが価格比較UIで「${query}」を再検索しました。上位結果:\n${top || "該当なし"}` }],
      }).catch(() => {});
    }
  } catch (err) {
    setStatus(`検索に失敗しました: ${err instanceof Error ? err.message : err}`, true);
  } finally {
    btn.disabled = false;
  }
});
sortEl.addEventListener("change", render);

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});
