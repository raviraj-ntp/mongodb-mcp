/**
 * @raviraj87/mongodb-mcp · server.ts
 * MCP server factory — registers MongoDB tools and resources.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConnectionManager } from "./client/connectionManager.js";
import { registerResources } from "./resources/index.js";
import { registerAdminTools } from "./tools/adminTools.js";
import { registerAssistantTools } from "./tools/assistantTools.js";
import { registerAtlasTools } from "./tools/atlasTools.js";
import { registerCompositeTools } from "./tools/compositeTools.js";
import { registerConnectionTools } from "./tools/connectionTools.js";
import { registerDiagnosticTools } from "./tools/diagnosticTools.js";
import { registerMetadataTools } from "./tools/metadataTools.js";
import { registerReadTools } from "./tools/readTools.js";
import { registerWriteTools } from "./tools/writeTools.js";

export function createMongoMcpServer(mgr: ConnectionManager): McpServer {
  const server = new McpServer({
    name: "mongodb-mcp",
    version: "1.0.0",
  });

  registerConnectionTools(server, mgr);
  registerMetadataTools(server, mgr);
  registerReadTools(server, mgr);
  registerWriteTools(server, mgr);
  registerAdminTools(server, mgr);
  registerDiagnosticTools(server, mgr);
  registerCompositeTools(server, mgr);
  registerAssistantTools(server, mgr);
  registerAtlasTools(server, mgr);
  registerResources(server, mgr);

  return server;
}
