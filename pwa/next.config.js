/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA headers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control',  value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  // Rewrites — sw.js na manifest kutoka public/
  async rewrites() {
    return [
      { source: '/sw.js',       destination: '/_next/static/sw.js' },
      { source: '/manifest.json', destination: '/manifest.json' },
    ];
  },
};

module.exports = nextConfig;
