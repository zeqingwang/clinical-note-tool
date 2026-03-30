import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse / pdfjs-dist load pdf.worker via paths that break when Turbopack bundles them
   * into `.next/dev/server/chunks`. Keep them external so Node resolves workers from node_modules.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
