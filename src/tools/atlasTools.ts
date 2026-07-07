/**
 * @raviraj87/mongodb-mcp · tools/atlasTools.ts
 * Atlas API MCP tools.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveEnv } from "../config/loadConfig.js";
import { AtlasClient } from "../client/atlasClient.js";
import type { ConnectionManager } from "../client/connectionManager.js";
import { jsonResult, registerTool } from "./common.js";

export function registerAtlasTools(server: McpServer, mgr: ConnectionManager): void {
  const config = mgr.getConfig();
  if (!config.atlas.enabled) return;

  const client = new AtlasClient(
    resolveEnv(config.atlas.public_key_env),
    resolveEnv(config.atlas.private_key_env),
  );

  registerTool(server, "atlas_list_orgs", "List Atlas organizations.", async () =>
    jsonResult(await client.get("/orgs")),
  );

  registerTool(
    server,
    "atlas_list_projects",
    "List Atlas projects in an organization.",
    { orgId: z.string() },
    async ({ orgId }) => jsonResult(await client.get(`/orgs/${orgId}/groups`)),
  );

  registerTool(
    server,
    "atlas_list_clusters",
    "List Atlas clusters in a project.",
    { projectId: z.string().optional() },
    async ({ projectId }) => {
      const pid = projectId ?? config.atlas.default_project_id;
      if (!pid) throw new Error("projectId required (or set atlas.default_project_id in config)");
      return jsonResult(await client.get(`/groups/${pid}/clusters`));
    },
  );

  registerTool(
    server,
    "atlas_inspect_cluster",
    "Get Atlas cluster details.",
    { projectId: z.string().optional(), clusterName: z.string() },
    async ({ projectId, clusterName }) => {
      const pid = projectId ?? config.atlas.default_project_id;
      if (!pid) throw new Error("projectId required");
      return jsonResult(await client.get(`/groups/${pid}/clusters/${clusterName}`));
    },
  );

  registerTool(
    server,
    "atlas_list_db_users",
    "List Atlas database users in a project.",
    { projectId: z.string().optional() },
    async ({ projectId }) => {
      const pid = projectId ?? config.atlas.default_project_id;
      if (!pid) throw new Error("projectId required");
      return jsonResult(await client.get(`/groups/${pid}/databaseUsers`));
    },
  );

  registerTool(
    server,
    "atlas_list_alerts",
    "List Atlas alerts for a project.",
    {
      projectId: z.string().optional(),
      status: z.enum(["OPEN", "CLOSED", "TRACKING"]).optional(),
    },
    async ({ projectId, status }) => {
      const pid = projectId ?? config.atlas.default_project_id;
      if (!pid) throw new Error("projectId required");
      const qs = status ? `?status=${status}` : "?status=OPEN";
      return jsonResult(await client.get(`/groups/${pid}/alerts${qs}`));
    },
  );

  registerTool(
    server,
    "atlas_performance_advisor",
    "Get Atlas performance advisor suggestions.",
    { projectId: z.string().optional(), clusterName: z.string() },
    async ({ projectId, clusterName }) => {
      const pid = projectId ?? config.atlas.default_project_id;
      if (!pid) throw new Error("projectId required");
      const [suggested, slowQuery] = await Promise.all([
        client.get(`/groups/${pid}/clusters/${clusterName}/performanceAdvisor/suggestedIndexes`),
        client.get(`/groups/${pid}/clusters/${clusterName}/performanceAdvisor/slowQueryLogs`),
      ]);
      return jsonResult({ suggestedIndexes: suggested, slowQueryLogs: slowQuery });
    },
  );
}
