/**
 * @raviraj87/mongodb-mcp · tools/metadataTools.ts
 * Schema, indexes, and metadata MCP tools.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { inferSchema } from "../client/connectionManager.js";
import { parseEjson, serializeEjson } from "../util/bson.js";
import { assertNoServerSideJs } from "../util/guards.js";
import {
  collectionField,
  connectionField,
  dbField,
  jsonResult,
  registerTool,
} from "./common.js";

export function registerMetadataTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "list_databases",
    "List all databases on a connection.",
    { connection: connectionField },
    async ({ connection }) => {
      const client = await mgr.getClient(connection);
      const admin = client.db().admin();
      const { databases } = await admin.listDatabases();
      return jsonResult(databases);
    },
  );

  registerTool(
    server,
    "list_collections",
    "List collections in a database.",
    { connection: connectionField, database: dbField },
    async ({ connection, database }) => {
      const db = await mgr.getDb(connection, database);
      const collections = await db.listCollections().toArray();
      return jsonResult(collections);
    },
  );

  registerTool(
    server,
    "collection_schema",
    "Infer collection schema by sampling documents.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      sampleSize: z.number().optional().default(50),
    },
    async ({ connection, database, collection, sampleSize }) => {
      const settings = mgr.settingsFor(connection);
      const db = await mgr.getDb(connection, database);
      const docs = await db
        .collection(collection)
        .aggregate([{ $sample: { size: Math.min(sampleSize ?? 50, settings.maxDocumentsPerQuery) } }])
        .toArray();
      const schema = await inferSchema(docs);
      return jsonResult({ sampleSize: docs.length, schema, samples: docs.slice(0, 3).map(serializeEjson) });
    },
  );

  registerTool(
    server,
    "collection_indexes",
    "List indexes for a collection.",
    { connection: connectionField, database: dbField, collection: collectionField },
    async ({ connection, database, collection }) => {
      const db = await mgr.getDb(connection, database);
      const indexes = await db.collection(collection).indexes();
      return jsonResult(indexes);
    },
  );

  registerTool(
    server,
    "collection_storage_size",
    "Get collection storage stats.",
    { connection: connectionField, database: dbField, collection: collectionField },
    async ({ connection, database, collection }) => {
      const db = await mgr.getDb(connection, database);
      const stats = await db.command({ collStats: collection });
      return jsonResult(stats);
    },
  );

  registerTool(
    server,
    "db_stats",
    "Get database statistics.",
    { connection: connectionField, database: dbField },
    async ({ connection, database }) => {
      const db = await mgr.getDb(connection, database);
      return jsonResult(await db.stats());
    },
  );

  registerTool(
    server,
    "collection_stats",
    "Detailed collection stats via collStats.",
    { connection: connectionField, database: dbField, collection: collectionField },
    async ({ connection, database, collection }) => {
      const db = await mgr.getDb(connection, database);
      return jsonResult(await db.command({ collStats: collection, indexDetails: true }));
    },
  );

  registerTool(
    server,
    "validate_collection",
    "Validate a collection (full validation can be slow).",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      full: z.boolean().optional(),
    },
    async ({ connection, database, collection, full }) => {
      const db = await mgr.getDb(connection, database);
      return jsonResult(await db.command({ validate: collection, full: full ?? false }));
    },
  );

  registerTool(
    server,
    "distinct",
    "Get distinct values for a field.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      field: z.string(),
      filter: z.string().optional().describe("EJSON filter"),
    },
    async ({ connection, database, collection, field, filter }) => {
      const settings = mgr.settingsFor(connection);
      const parsed = parseEjson(filter, {});
      if (settings.disableServerSideJs) assertNoServerSideJs(parsed, "filter");
      const db = await mgr.getDb(connection, database);
      const values = await db.collection(collection).distinct(field, parsed);
      return jsonResult(values.slice(0, settings.maxDocumentsPerQuery));
    },
  );
}
