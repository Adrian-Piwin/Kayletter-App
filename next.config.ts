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
};

export default nextConfig;
