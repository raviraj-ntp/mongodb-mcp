import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { jsonResult } from "../util/response.js";

export { jsonResult };

export const connectionField = z
  .string()
  .optional()
  .describe("Named connection from config; defaults to default_connection");

export const dbField = z.string().describe("Database name");
export const collectionField = z.string().describe("Collection name");
export const confirmedField = z
  .boolean()
  .optional()
  .describe("Must be true for destructive operations when confirmation is required");

export const ejsonField = (desc: string) => z.string().optional().describe(`${desc} (EJSON string)`);

export function registerTool(
  server: McpServer,
  name: string,
  description: string,
  handler: () => Promise<any>,
): void;
export function registerTool<Args extends Record<string, z.ZodTypeAny>>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Args,
  handler: (args: z.infer<z.ZodObject<Args>>) => Promise<any>,
): void;
export function registerTool<Args extends Record<string, z.ZodTypeAny>>(
  server: McpServer,
  name: string,
  description: string,
  schemaOrHandler: Args | (() => Promise<any>),
  handler?: (args: z.infer<z.ZodObject<Args>>) => Promise<any>,
): void {
  if (typeof schemaOrHandler === "function") {
    server.registerTool(name, { description }, schemaOrHandler as any);
    return;
  }
  server.registerTool(name, { description, inputSchema: schemaOrHandler }, handler as any);
}

export function withManager(
  mgr: ConnectionManager,
  toolName: string,
  fn: (mgr: ConnectionManager, settings: ReturnType<ConnectionManager["settingsFor"]>) => Promise<unknown>,
  connection?: string,
) {
  return async () => {
    const settings = mgr.settingsFor(connection);
    const data = await fn(mgr, settings);
    return jsonResult(data);
  };
}

export function checkWrite(settings: ReturnType<ConnectionManager["settingsFor"]>, op: string): void {
  if (settings.readOnly) {
    throw new Error(`Operation '${op}' blocked: connection '${settings.name}' is read-only`);
  }
}

export function checkConfirmation(
  mgr: ConnectionManager,
  toolName: string,
  confirmed?: boolean,
): void {
  const required = mgr.getConfig().confirmation_required_tools;
  if (!required.includes(toolName)) return;
  if (!confirmed) throw new Error(`Tool '${toolName}' requires confirmed=true`);
}
