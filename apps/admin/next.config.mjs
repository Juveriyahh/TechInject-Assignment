/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources and are compiled by Next.
  transpilePackages: ['@tech-inject/ui', '@tech-inject/database', '@tech-inject/shared'],
  // Linting runs as its own workspace task, so builds stay fast.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
