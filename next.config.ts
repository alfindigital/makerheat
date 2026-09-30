import type { NextConfig } from "next";

const config: NextConfig = {
  // node:sqlite is a builtin — tell Next not to bundle it
  serverExternalPackages: ["node:sqlite"],
  // readFileSync'd paths aren't auto-traced into the lambda bundle
  outputFileTracingIncludes: {
    "/api/scan": ["./fixtures/manifest.json"],
  },
};

export default config;
