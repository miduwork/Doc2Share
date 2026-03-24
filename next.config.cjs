const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/tai-lieu", destination: "/cua-hang", permanent: true },
      { source: "/tai-lieu/:path*", destination: "/cua-hang/:path*", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/**' },
    ],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
