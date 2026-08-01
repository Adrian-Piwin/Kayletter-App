import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    // Old Firebase-site URLs that may still be bookmarked
    return [
      { source: "/login.html", destination: "/", permanent: true },
      { source: "/input.html", destination: "/notes", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required for PostHog trailing-slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
