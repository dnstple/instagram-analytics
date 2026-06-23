/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Instagram CDN thumbnails are served from these hosts.
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
    ],
  },
};

module.exports = nextConfig;
