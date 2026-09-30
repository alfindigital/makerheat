import type { NextConfig } from "next";

const config: NextConfig = {
  // node:sqlite is a builtin — tell Next not to bundle it
  serverExternalPackages: ["node:sqlite"],
  // readFileSync'd paths aren't auto-traced into the lambda bundle —
  // ship the manifest plus the public replay demo corpus (jup-solana-* only).
  outputFileTracingIncludes: {
    "/api/scan": [
      "./fixtures/manifest.json",
      "./fixtures/jup-solana-now-*.json",
      "./fixtures/jup-solana-keyless-*.json",
      "./fixtures/jup-solana-keyed-*.json",
    ],
  },
};

export default config;
