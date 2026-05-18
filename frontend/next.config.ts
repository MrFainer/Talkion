import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*', // Ajuste essa URL caso o backend rode em outro domínio na produção
      },
    ];
  },
};

export default nextConfig;
