/**
 * @raviraj87/mongodb-mcp · config/loadConfig.ts
 * YAML and environment configuration loader.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { AppConfig, configSchema } from "./schema.js";

export function resolveConfigPath(): string {
  const fromEnv = process.env.MONGODB_MCP_CONFIG?.trim();
  if (fromEnv) return fromEnv.replace(/^~(?=\/|$)/, homedir());
  return join(homedir(), ".mongodb-mcp.yaml");
}

export function resolveEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(): AppConfig {
  const path = resolveConfigPath();
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    return configSchema.parse(parse(raw));
  }
  return loadConfigFromEnv();
}

function loadConfigFromEnv(): AppConfig {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      `Config file not found at ${resolveConfigPath()} and MONGODB_URI is not set. ` +
        `Set MONGODB_MCP_CONFIG or provide MONGODB_URI.`,
    );
  }

  const defaultConnection = process.env.MONGODB_DEFAULT_CONNECTION?.trim() || "default";
  const connections: AppConfig["connections"] = {
    [defaultConnection]: {
      description: "From MONGODB_URI",
      uri_env: "MONGODB_URI",
    },
  };

  const extra = process.env.MONGODB_EXTRA_CONNECTIONS?.trim();
  if (extra) {
    for (const pair of extra.split(",")) {
      const [name, envVar] = pair.split(":").map((s) => s.trim());
      if (name && envVar) {
        connections[name] = { uri_env: envVar };
      }
    }
  }

  return configSchema.parse({
    default_connection: defaultConnection,
    connections,
    read_only: process.env.MONGODB_READ_ONLY?.toLowerCase() === "true",
    index_check: process.env.MONGODB_INDEX_CHECK?.toLowerCase() === "true",
    disable_server_side_js: process.env.MONGODB_DISABLE_SERVER_SIDE_JS?.toLowerCase() !== "false",
    max_documents_per_query: Number(process.env.MONGODB_MAX_DOCUMENTS_PER_QUERY ?? 100),
    connection_filter: process.env.MONGODB_CONNECTION_FILTER ?? "",
    assistant: {
      enabled: process.env.MONGODB_ASSISTANT_ENABLED?.toLowerCase() !== "false",
    },
    atlas: {
      enabled: process.env.MONGODB_ATLAS_ENABLED?.toLowerCase() === "true",
    },
  });
}

export function redactedConfig(config: AppConfig): Record<string, unknown> {
  return {
    default_connection: config.default_connection,
    read_only: config.read_only,
    index_check: config.index_check,
    disable_server_side_js: config.disable_server_side_js,
    max_documents_per_query: config.max_documents_per_query,
    connection_filter: config.connection_filter,
    connections: Object.fromEntries(
      Object.entries(config.connections).map(([name, c]) => [
        name,
        {
          description: c.description,
          uri_env: c.uri_env,
          read_only: c.read_only,
          allowed_databases: c.allowed_databases,
        },
      ]),
    ),
    assistant: config.assistant,
    atlas: { ...config.atlas, public_key_env: config.atlas.public_key_env, private_key_env: config.atlas.private_key_env },
  };
}
