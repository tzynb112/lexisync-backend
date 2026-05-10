/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true'

const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3003'],
    },
  },
  assetPrefix: undefined,
  generateEtags: false,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (isExport) return []
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
}

if (isExport) {
  nextConfig.output = 'export'
  nextConfig.distDir = 'out'
}

module.exports = nextConfig
