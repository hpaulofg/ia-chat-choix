import type { NextConfig } from "next";

/** Configuração Next.js (equivalente a `next.config.js`; TypeScript é suportado nativamente). */
const nextConfig: NextConfig = {
  /** Build mínimo para Docker (`node server.js` no output standalone). */
  output: "standalone",
  /** Menos ruído em cabeçalhos HTTP em produção. */
  poweredByHeader: false,
  /** Esconde o botão “N” e o menu de dev (Route, Turbopack, etc.) em `next dev`. */
  devIndicators: false,
};

export default nextConfig;
