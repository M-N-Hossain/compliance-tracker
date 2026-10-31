import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server in .next/standalone for the Docker image
  output: "standalone",
  // Stops next dev from writing AGENTS.md when it detects an AI coding agent.
  agentRules: false,
};

export default nextConfig;
