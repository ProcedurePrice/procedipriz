import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Verification builds can use a separate output dir so `next build` never
  // overwrites the dev server's `.next` (overwriting it corrupts a running
  // `next dev` → ENOENT on _buildManifest / app-build-manifest). Default stays
  // `.next`, so Vercel and `npm run build` are unaffected.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
