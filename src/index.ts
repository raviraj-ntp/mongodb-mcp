#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConnectionManager } from "./client/connectionManager.js";
import { createMongoMcpServer } from "./server.js";

async function main(): Promise<void> {
  const mgr = new ConnectionManager();
  const server = createMongoMcpServer(mgr);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await mgr.closeAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
