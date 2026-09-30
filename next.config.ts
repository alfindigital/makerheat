import type { NextConfig } from "next";

const config: NextConfig = {
  // node:sqlite is a builtin — tell Next not to bundle it
  serverExternalPackages: ["node:sqlite"],
};

export default config;
