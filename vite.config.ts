import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// UI を 1 つの HTML にまとめ、MCP リソースとして配信する
export default defineConfig({
  root: "src/ui",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
    rollupOptions: { input: "src/ui/mcp-app.html" },
  },
});
