/** @type {import('next').NextConfig} */
const nextConfig = {
    // Image optimization settings
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
            },
            {
                protocol: 'https',
                hostname: 'imveiimfzvhzadbjdxki.supabase.co',
            },
        ],
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },

    // Experimental features for better performance
    experimental: {
        optimizeCss: true,
        scrollRestoration: true,
    },

    // Turbopack configuration
    turbopack: {},

    // Headers for security and PWA
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                ],
            },
            {
                source: '/sw.js',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=0, must-revalidate',
                    },
                    {
                        key: 'Service-Worker-Allowed',
                        value: '/',
                    },
                ],
            },
            {
                source: '/manifest.json',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/manifest+json',
                    },
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/icons/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
        ]
    },

    // Webpack configuration for PWA
    webpack: (config, { dev, isServer }) => {
        // Service worker externals
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            }
        }

        // Bundle analyzer (only in production)
        if (!dev && !isServer) {
            // Add bundle analyzer if needed
            // const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
            // config.plugins.push(
            //   new BundleAnalyzerPlugin({
            //     analyzerMode: 'static',
            //     openAnalyzer: false,
            //   })
            // )
        }

        return config
    },

    // Compression and optimization
    compress: true,

    // Output configuration for static export if needed
    // output: 'export',
    // trailingSlash: true,
    // skipTrailingSlashRedirect: true,
    // distDir: 'dist',

    // Environment variables
    env: {
        NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '1.0.0',
    },
}

module.exports = nextConfig
