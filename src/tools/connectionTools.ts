/**
 * @raviraj87/mongodb-mcp · tools/connectionTools.ts
 * Connection listing and runtime connect tools.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { connectionField, jsonResult, registerTool } from "./common.js";

export function registerConnectionTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(server, "list_connections", "List all configured MongoDB connections (names only, no URIs).", async () =>
    jsonResult({
      default_connection: mgr.defaultConnection(),
      connections: mgr.listConnections(),
    }),
  );

  registerTool(
    server,
    "ping",
    "Ping a MongoDB connection.",
    { connection: connectionField },
    async ({ connection }) => jsonResult(await mgr.ping(connection)),
  );

  registerTool(
    server,
    "connect",
    "Add or replace a runtime MongoDB connection by URI. Use a unique name.",
    {
      name: z.string().describe("Connection name (e.g. temp-prod)"),
      connectionString: z.string(),
      description: z.string().optional(),
      readOnly: z.boolean().optional(),
    },
    async ({ name, connectionString, description, readOnly }) => {
      await mgr.addRuntimeConnection(name, connectionString, { description, readOnly });
      return jsonResult({ connected: name, readOnly: readOnly ?? false });
    },
  );
}
