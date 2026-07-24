/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/manifest.webmanifest',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
    },
    {
      source: '/icons/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, immutable' }],
    },
  ],
};

export default nextConfig;
