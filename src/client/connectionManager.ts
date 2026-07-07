/**
 * @raviraj87/mongodb-mcp · client/connectionManager.ts
 * Multi-connection MongoDB client pool and lifecycle.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { MongoClient, type Db, type Document } from "mongodb";
import { loadConfig, resolveEnv } from "../config/loadConfig.js";
import type { AppConfig, EffectiveConnectionSettings } from "../config/schema.js";

export type ConnectionInfo = {
  name: string;
  description?: string;
  readOnly: boolean;
  source: "config" | "runtime";
  connected: boolean;
};

type RuntimeConnection = {
  uri: string;
  description?: string;
  readOnly?: boolean;
};

export class ConnectionManager {
  private readonly config: AppConfig;
  private readonly clients = new Map<string, MongoClient>();
  private readonly runtime = new Map<string, RuntimeConnection>();
  private lastError: { connection: string; message: string; at: string } | null = null;

  constructor(config?: AppConfig) {
    this.config = config ?? loadConfig();
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getLastError() {
    return this.lastError;
  }

  listConnections(): ConnectionInfo[] {
    const names = this.visibleConnectionNames();
    return names.map((name) => {
      const settings = this.settingsFor(name);
      return {
        name,
        description: settings.description,
        readOnly: settings.readOnly,
        source: this.runtime.has(name) ? "runtime" : "config",
        connected: this.clients.has(name),
      };
    });
  }

  defaultConnection(): string {
    const names = this.visibleConnectionNames();
    if (names.includes(this.config.default_connection)) return this.config.default_connection;
    return names[0];
  }

  settingsFor(connection?: string): EffectiveConnectionSettings {
    const name = this.resolveName(connection);
    const entry = this.config.connections[name];
    const runtime = this.runtime.get(name);
    return {
      name,
      description: runtime?.description ?? entry?.description,
      readOnly: runtime?.readOnly ?? entry?.read_only ?? this.config.read_only,
      indexCheck: this.config.index_check,
      disableServerSideJs: this.config.disable_server_side_js,
      maxDocumentsPerQuery: entry?.max_documents_per_query ?? this.config.max_documents_per_query,
      maxPayloadBytes: this.config.max_payload_bytes,
      allowedDatabases: entry?.allowed_databases,
    };
  }

  async getClient(connection?: string): Promise<MongoClient> {
    const name = this.resolveName(connection);
    const existing = this.clients.get(name);
    if (existing) return existing;

    const uri = this.resolveUri(name);
    try {
      const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      });
      await client.connect();
      this.clients.set(name, client);
      this.lastError = null;
      return client;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = { connection: name, message, at: new Date().toISOString() };
      throw err;
    }
  }

  async getDb(connection: string | undefined, database: string): Promise<Db> {
    const settings = this.settingsFor(connection);
    const { assertDatabaseAllowed } = await import("../util/guards.js");
    assertDatabaseAllowed(database, settings.allowedDatabases);
    const client = await this.getClient(connection);
    return client.db(database);
  }

  async ping(connection?: string): Promise<{ ok: number; connection: string }> {
    const name = this.resolveName(connection);
    const client = await this.getClient(name);
    const result = await client.db("admin").command({ ping: 1 });
    return { ok: result.ok as number, connection: name };
  }

  async addRuntimeConnection(
    name: string,
    uri: string,
    opts?: { description?: string; readOnly?: boolean },
  ): Promise<void> {
    if (this.clients.has(name)) {
      await this.clients.get(name)!.close();
      this.clients.delete(name);
    }
    this.runtime.set(name, { uri, description: opts?.description, readOnly: opts?.readOnly });
    await this.getClient(name);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.close()));
    this.clients.clear();
  }

  private visibleConnectionNames(): string[] {
    const filter = this.config.connection_filter
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const configNames = Object.keys(this.config.connections);
    const runtimeNames = [...this.runtime.keys()];
    const all = [...new Set([...configNames, ...runtimeNames])];
    if (!filter.length) return all;
    return all.filter((n) => filter.includes(n));
  }

  private resolveName(connection?: string): string {
    const name = connection ?? this.defaultConnection();
    const visible = this.visibleConnectionNames();
    if (!visible.includes(name)) {
      throw new Error(`Unknown connection '${name}'. Available: ${visible.join(", ") || "(none)"}`);
    }
    if (!this.config.connections[name] && !this.runtime.has(name)) {
      throw new Error(`Unknown connection: ${name}`);
    }
    return name;
  }

  private resolveUri(name: string): string {
    const runtime = this.runtime.get(name);
    if (runtime) return runtime.uri;
    const entry = this.config.connections[name];
    if (!entry) throw new Error(`Unknown connection: ${name}`);
    return resolveEnv(entry.uri_env);
  }
}

export async function inferSchema(
  docs: Document[],
): Promise<Record<string, { types: string[]; count: number }>> {
  const fields: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};

  for (const doc of docs) {
    walk(doc, "", fields, counts);
  }

  const out: Record<string, { types: string[]; count: number }> = {};
  for (const [path, types] of Object.entries(fields)) {
    out[path] = { types: [...types].sort(), count: counts[path] ?? 0 };
  }
  return out;
}

function walk(
  value: unknown,
  prefix: string,
  fields: Record<string, Set<string>>,
  counts: Record<string, number>,
): void {
  if (value === null || value === undefined) {
    addField(prefix || "null", "null", fields, counts);
    return;
  }
  if (Array.isArray(value)) {
    addField(prefix || "array", "array", fields, counts);
    for (const item of value.slice(0, 5)) walk(item, `${prefix}[]`, fields, counts);
    return;
  }
  if (value instanceof Date) {
    addField(prefix, "date", fields, counts);
    return;
  }
  if (typeof value === "object") {
    const ctor = (value as { _bsontype?: string })._bsontype;
    if (ctor) {
      addField(prefix, ctor.toLowerCase(), fields, counts);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      walk(v, path, fields, counts);
    }
    return;
  }
  addField(prefix, typeof value, fields, counts);
}

function addField(
  path: string,
  type: string,
  fields: Record<string, Set<string>>,
  counts: Record<string, number>,
): void {
  if (!path) return;
  fields[path] ??= new Set();
  fields[path].add(type);
  counts[path] = (counts[path] ?? 0) + 1;
}
