import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
 // outputFileTracingRoot: import.meta.dirname,
  turbopack: {},

  // ✅ webpack 설정 추가
  webpack(config) {
    // '@'를 프로젝트 루트(moyulab-erp-db)로 지정
    config.resolve.alias['@'] = path.resolve(import.meta.dirname);
    return config;
  },
};

export default nextConfig;




