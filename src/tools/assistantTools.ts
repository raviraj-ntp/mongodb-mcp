import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { jsonResult, registerTool } from "./common.js";

export function registerAssistantTools(server: McpServer, mgr: ConnectionManager): void {
  const config = mgr.getConfig();
  if (!config.assistant.enabled) return;

  const baseUrl = config.assistant.base_url.replace(/\/+$/, "");

  registerTool(
    server,
    "list_knowledge_sources",
    "List MongoDB documentation sources available in the Assistant knowledge base.",
    async () => {
      const res = await fetch(`${baseUrl}/data-sources`);
      if (!res.ok) throw new Error(`Assistant API error: ${res.status} ${await res.text()}`);
      return jsonResult(await res.json());
    },
  );

  registerTool(
    server,
    "search_knowledge",
    "Search MongoDB official docs and curated guidance (version-filterable).",
    {
      query: z.string(),
      limit: z.number().optional().default(5),
      dataSources: z
        .array(
          z.object({
            name: z.string(),
            versionLabel: z.string().optional(),
          }),
        )
        .optional(),
    },
    async ({ query, limit, dataSources }) => {
      const res = await fetch(`${baseUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, limit: limit ?? 5, dataSources }),
      });
      if (!res.ok) throw new Error(`Assistant API error: ${res.status} ${await res.text()}`);
      return jsonResult(await res.json());
    },
  );
}
