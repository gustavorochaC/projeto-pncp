const nextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  transpilePackages: ["@pncp/ui", "@pncp/types", "@pncp/sdk", "@pncp/config"]
};

export default nextConfig;
