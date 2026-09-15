import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "build", emptyOutDir: true },
  define: {
    "import.meta.env.VITE_EMBED_CONTENT": JSON.stringify(process.env.SITES_MANAGED_LINUX_CONTAINER === "1"),
  },
});
