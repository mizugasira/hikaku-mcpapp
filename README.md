# hikaku-mcpapp — ショッピング横断 価格比較 MCP App

Claude に「○○の最安値を比較して」と頼むと、楽天市場・Yahoo!ショッピングなどを横断検索し、
**チャット内にインタラクティブな価格比較表**を表示する [MCP App](https://github.com/modelcontextprotocol/ext-apps) です。

- 価格の安い順に統合表示 (最安値・中央値・最高値・件数のサマリー付き)
- 最安商品のハイライト、最安値との差額表示、送料無料/レビュー表示
- ショップ別の絞り込み・並び替え (価格の安い順/高い順・レビュー数)
- 比較表の検索欄から再検索 (結果は Claude にも共有されます)
- API が無いサービス (Amazon・価格.com・メルカリ) は検索結果ページへのリンクで補完

| サービス | 取得方法 | 必要な設定 |
| --- | --- | --- |
| 楽天市場 | 楽天ウェブサービス 商品検索API | `RAKUTEN_APP_ID`, `RAKUTEN_ACCESS_KEY`, `RAKUTEN_REFERER` |
| Yahoo!ショッピング | 商品検索API (V3) | `YAHOO_APP_ID` |
| Amazon / 価格.com / メルカリ | 検索リンク | なし |

設定されていないサービスはスキップされ、比較表に「未設定」と表示されます。

## 構成

```
src/
  main.ts              HTTP (Streamable HTTP) / stdio エントリポイント
  server.ts            MCP ツール compare-prices と UI リソースの登録
  providers/           各ショッピングサービスの検索実装
  ui/                  比較表 UI (Vite で単一 HTML にバンドル)
Dockerfile / render.yaml  デプロイ用
```

## 1. API キーの取得

1. **楽天**: <https://webservice.rakuten.co.jp/> でアプリ ID を発行し、アプリ ID とアクセスキーを控える。
   「許可されたWebサイト」にデプロイ先の URL (例: `https://hikaku-mcpapp.onrender.com`) を登録し、
   同じ URL を `RAKUTEN_REFERER` に設定する。
   (2026年5月に旧 API が終了し、アクセスキーと Referer が必須になりました。
   エンドポイントが変わった場合は `RAKUTEN_ENDPOINT` で上書きできます)
2. **Yahoo!**: <https://e.developer.yahoo.co.jp/> でアプリケーションを登録し、Client ID を `YAHOO_APP_ID` に設定する。

## 2. ローカルで動かす

```bash
npm install
npm run build
cp .env.example .env   # キーを記入
node --env-file=.env dist/main.js
# => http://localhost:3001/mcp
```

API キーが無くても `DEMO_MODE=1` でダミーデータを使って UI を確認できます。

Claude Desktop で stdio 接続する場合:

```json
{
  "mcpServers": {
    "hikaku": {
      "command": "node",
      "args": ["/path/to/hikaku-mcpapp/dist/main.js", "--stdio"],
      "env": { "RAKUTEN_APP_ID": "...", "RAKUTEN_ACCESS_KEY": "...", "RAKUTEN_REFERER": "...", "YAHOO_APP_ID": "..." }
    }
  }
}
```

## 3. サーバーへデプロイ (Render の例)

1. <https://dashboard.render.com/> → **New → Blueprint** → このリポジトリを選択
2. `render.yaml` が読み込まれるので、`RAKUTEN_APP_ID` などの環境変数を入力して **Apply**
3. `MCP_PATH_TOKEN` は自動生成されます。Environment 画面で値を確認してください
4. MCP の URL は `https://<サービス名>.onrender.com/mcp/<MCP_PATH_TOKEN>`

Docker が動く環境ならどこでも動きます (Fly.io, Cloud Run, VPS など):

```bash
docker build -t hikaku-mcpapp .
docker run -p 3001:3001 --env-file .env hikaku-mcpapp
```

## 4. Claude に登録する

1. claude.ai → **設定 → コネクタ → カスタムコネクタを追加**
2. 名前: `価格比較`、URL: 上記の MCP URL (`https://.../mcp/<トークン>`) を入力して追加
3. チャットで「AirPods Pro の最安値を比較して」のように依頼すると、比較表が表示されます

> `MCP_PATH_TOKEN` を設定すると、トークンを含む URL を知っている人だけが利用できます。
> トークン無しで公開すると第三者に API の利用枠を使われる可能性があるので、設定を推奨します。

## ツール仕様

`compare-prices`

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `query` | string (必須) | 商品名・キーワード |
| `limit` | number (1–30, 既定 10) | 各サービスから取得する件数 |
| `minPrice` / `maxPrice` | number | 価格帯 (円) |
