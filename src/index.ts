#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupServer } from "./mcp-server.js";

async function main() {
  try {
    const server = setupServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Monobank MCP server running on stdio");
  } catch (error) {
    console.error(`Error starting server: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Unhandled error: ${error}`);
  process.exit(1);
});
