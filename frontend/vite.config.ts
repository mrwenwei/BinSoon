import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_API_BASE } from "./src/data/apiConfig";

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
    plugins: [react()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
