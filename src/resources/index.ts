import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConnectionManager } from "../client/connectionManager.js";
import { redactedConfig } from "../config/loadConfig.js";
import { serializeEjson } from "../util/bson.js";
import { exportStore } from "../util/exports.js";
import { stringify } from "../util/response.js";

export function registerResources(server: McpServer, mgr: ConnectionManager): void {
  server.registerResource(
    "config",
    "config://config",
    { description: "Redacted server configuration", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "config://config",
          mimeType: "application/json",
          text: stringify(redactedConfig(mgr.getConfig())),
        },
      ],
    }),
  );

  server.registerResource(
    "debug",
    "debug://mongodb",
    { description: "Last MongoDB connectivity error", mimeType: "application/json" },
    async () => ({
      contents: [
        {
          uri: "debug://mongodb",
          mimeType: "application/json",
          text: stringify({
            connections: mgr.listConnections(),
            lastError: mgr.getLastError(),
          }),
        },
      ],
    }),
  );

  server.registerResource(
    "exported-data",
    new ResourceTemplate("exported-data://{exportName}", { list: undefined }),
    { description: "Data exported via export_query tool", mimeType: "application/json" },
    async (uri, { exportName }) => {
      const name = Array.isArray(exportName) ? exportName[0] : exportName;
      const data = exportStore.get(name);
      if (!data) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: stringify({ error: "Export not found or expired", available: exportStore.list() }),
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: serializeEjson(data),
          },
        ],
      };
    },
  );
}
