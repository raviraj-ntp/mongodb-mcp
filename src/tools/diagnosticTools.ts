import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { connectionField, dbField, jsonResult, registerTool } from "./common.js";

export function registerDiagnosticTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "server_status",
    "Run serverStatus command (admin db).",
    { connection: connectionField, options: z.string().optional().describe("EJSON options") },
    async ({ connection, options }) => {
      const client = await mgr.getClient(connection);
      const opts = options ? JSON.parse(options) : {};
      return jsonResult(await client.db("admin").command({ serverStatus: 1, ...opts }));
    },
  );

  registerTool(
    server,
    "current_ops",
    "List current operations on the server.",
    {
      connection: connectionField,
      filter: z.string().optional().describe("EJSON filter for $currentOp"),
      includeIdle: z.boolean().optional(),
    },
    async ({ connection, filter, includeIdle }) => {
      const client = await mgr.getClient(connection);
      const pipeline: object[] = [{ $currentOp: { allUsers: true, idleConnections: includeIdle ?? false } }];
      if (filter) pipeline.push({ $match: JSON.parse(filter) });
      pipeline.push({ $limit: 50 });
      const ops = await client.db("admin").aggregate(pipeline).toArray();
      return jsonResult(ops);
    },
  );

  registerTool(
    server,
    "repl_set_status",
    "Get replica set status.",
    { connection: connectionField },
    async ({ connection }) => {
      const client = await mgr.getClient(connection);
      try {
        return jsonResult(await client.db("admin").command({ replSetGetStatus: 1 }));
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err), note: "Not a replica set?" });
      }
    },
  );

  registerTool(
    server,
    "mongodb_logs",
    "Get recent mongod log messages (if getLog is available).",
    {
      connection: connectionField,
      logType: z.string().optional().default("global"),
      limit: z.number().optional().default(50),
    },
    async ({ connection, logType, limit }) => {
      const client = await mgr.getClient(connection);
      try {
        const result = await client.db("admin").command({ getLog: logType ?? "global" });
        const lines = (result.log as string[] | undefined) ?? [];
        return jsonResult({ totalLines: lines.length, log: lines.slice(-(limit ?? 50)) });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  registerTool(
    server,
    "list_commands",
    "List available MongoDB commands on the server.",
    { connection: connectionField, database: dbField.optional() },
    async ({ connection, database }) => {
      const client = await mgr.getClient(connection);
      const db = database ? client.db(database) : client.db("admin");
      return jsonResult(await db.command({ listCommands: 1 }));
    },
  );
}
