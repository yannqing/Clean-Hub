import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/saas/tenants/:tenantId/settings",
        destination: "/saas/tenants/:tenantId",
        permanent: true,
      },
    ];
  },
  ...(isDevelopment
    ? {}
    : { outputFileTracingRoot: join(currentDir, "../..") }),
  experimental: {
    // A 512 KB CSV expands when its rows are encoded as a typed JSON batch.
    serverActions: { bodySizeLimit: "2mb" },
    // Tree-shake icon/ barrel imports so only the icons actually referenced
    // by the app (e.g. the sidebar nav icons) end up in the client bundle,
    // rather than the whole lucide-react / @cleanhub/ui catalog.
    optimizePackageImports: ["lucide-react", "@cleanhub/ui"],
  },
};

export default nextConfig;
