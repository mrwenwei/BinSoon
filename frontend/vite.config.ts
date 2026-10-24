import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_API_BASE } from "./src/data/apiConfig";

// Serve the standalone public page before Vite's SPA fallback.
function demoPage(): Plugin {
  const configure = (server: Pick<ViteDevServer, "middlewares">) => {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/demo\/?(?:\?|$)/.test(req.url)) {
        req.url = req.url.replace(/^\/demo\/?(?=\?|$)/, "/demo/index.html");
      }
      next();
    });
  };
  return {
    name: "standalone-demo-page",
    configureServer: configure,
    configurePreviewServer: configure,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const upstream = new URL(env.VITE_API_BASE_URL || DEFAULT_API_BASE);
  const proxy = {
    "/api/v1": {
      target: upstream.origin,
      changeOrigin: true,
      rewrite: (path: string) =>
        path.replace(/^\/api\/v1(?=\/|\?|$)/, upstream.pathname.replace(/\/$/, "")),
    },
  };
  return {
    plugins: [react(), demoPage()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
