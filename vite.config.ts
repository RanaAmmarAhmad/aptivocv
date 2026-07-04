import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({ target: "react" }),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 8080,
    strictPort: true,
  },
});
