/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the app is a pure client-side SPA (all pages 'use client', data fetched
  // in the browser), so it builds to static HTML/JS in `out/` and deploys to Cloudflare Pages
  // with zero cold start. No SSR/Node host needed.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
