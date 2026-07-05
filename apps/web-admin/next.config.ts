import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(currentDir, "../.."),
  experimental: {
    // Tree-shake icon/ barrel imports so only the icons actually referenced
    // by the app (e.g. the sidebar nav icons) end up in the client bundle,
    // rather than the whole lucide-react / @cleanhub/ui catalog.
    optimizePackageImports: ["lucide-react", "@cleanhub/ui"],
  },
};

export default nextConfig;
