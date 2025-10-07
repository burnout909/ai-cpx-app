import type { NextConfig } from "next";


const nextConfig = {
  webpack(config: any) {
    // 기존 SVG rule 제거
    config.module.rules
      .filter((rule: any) => rule?.test?.test?.('.svg'))
      .forEach((rule: any) => (rule.exclude = /\.svg$/i));

    // SVGR 로더 추가
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default nextConfig;