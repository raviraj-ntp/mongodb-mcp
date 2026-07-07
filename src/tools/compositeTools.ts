/**
 * @raviraj87/mongodb-mcp · tools/compositeTools.ts
 * Composite multi-step MongoDB MCP tools.
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

export function registerCompositeTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "explore_collection",
    "Composite: schema + indexes + stats + sample docs in one call.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      sampleSize: z.number().optional().default(5),
    },
    async ({ connection, database, collection, sampleSize }) => {
      const settings = mgr.settingsFor(connection);
      const db = await mgr.getDb(connection, database);
      const coll = db.collection(collection);
      const n = Math.min(sampleSize ?? 5, settings.maxDocumentsPerQuery);
      const [indexes, stats, samples] = await Promise.all([
        coll.indexes(),
        db.command({ collStats: collection }),
        coll.aggregate([{ $sample: { size: n } }]).toArray(),
      ]);
      const schema = await inferSchema(samples);
      return jsonResult({
        connection: settings.name,
        database,
        collection,
        documentCount: (stats as { count?: number }).count,
        storageSize: (stats as { storageSize?: number }).storageSize,
        indexes,
        schema,
        samples: samples.map((d) => parseEjson(serializeEjson(d), d)),
      });
    },
  );

  registerTool(
    server,
    "database_overview",
    "Composite: list collections with document counts and sizes.",
    { connection: connectionField, database: dbField },
    async ({ connection, database }) => {
      const db = await mgr.getDb(connection, database);
      const [dbStats, collections] = await Promise.all([db.stats(), db.listCollections().toArray()]);
      const details = await Promise.all(
        collections.map(async (c) => {
          const name = c.name;
          try {
            const s = await db.command({ collStats: name });
            return {
              name,
              type: c.type,
              count: (s as { count?: number }).count,
              storageSize: (s as { storageSize?: number }).storageSize,
              indexCount: (s as { nindexes?: number }).nindexes,
            };
          } catch {
            return { name, type: c.type, error: "stats unavailable" };
          }
        }),
      );
      return jsonResult({ database, dbStats, collections: details });
    },
  );

  registerTool(
    server,
    "analyze_query",
    "Composite: explain a find query with a human-readable summary.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().optional(),
    },
    async ({ connection, database, collection, filter }) => {
      const settings = mgr.settingsFor(connection);
      const parsed = parseEjson(filter, {});
      if (settings.disableServerSideJs) assertNoServerSideJs(parsed, "filter");
      const db = await mgr.getDb(connection, database);
      const plan = await db.collection(collection).find(parsed).explain("executionStats");
      const planJson = JSON.stringify(plan);
      const usesCollScan = /COLLSCAN|collectionScan/i.test(planJson);
      const exec = (plan as any)?.executionStats;
      return jsonResult({
        usesCollectionScan: usesCollScan,
        recommendation: usesCollScan
          ? "Query performs a collection scan. Consider adding an index on filter fields."
          : "Query appears to use an index.",
        executionStats: exec,
        winningPlan: (plan as any)?.queryPlanner?.winningPlan,
      });
    },
  );

  registerTool(
    server,
    "compare_collections",
    "Compare document counts and indexes between two connections (e.g. prod vs staging).",
    {
      connectionA: z.string(),
      connectionB: z.string(),
      database: dbField,
      collection: collectionField,
    },
    async ({ connectionA, connectionB, database, collection }) => {
      const [dbA, dbB] = await Promise.all([
        mgr.getDb(connectionA, database),
        mgr.getDb(connectionB, database),
      ]);
      const [countA, countB, idxA, idxB] = await Promise.all([
        dbA.collection(collection).estimatedDocumentCount(),
        dbB.collection(collection).estimatedDocumentCount(),
        dbA.collection(collection).indexes(),
        dbB.collection(collection).indexes(),
      ]);
      return jsonResult({
        connectionA: { name: connectionA, count: countA, indexes: idxA },
        connectionB: { name: connectionB, count: countB, indexes: idxB },
        countDelta: countA - countB,
      });
    },
  );

  registerTool(
    server,
    "index_health",
    "Composite: list indexes with usage stats (if available) and flag collections without _id index issues.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
    },
    async ({ connection, database, collection }) => {
      const db = await mgr.getDb(connection, database);
      const coll = db.collection(collection);
      const indexes = await coll.indexes();
      let stats: unknown = null;
      try {
        stats = await coll.aggregate([{ $indexStats: {} }]).toArray();
      } catch {
        stats = { note: "$indexStats not available (may need admin or standalone)" };
      }
      return jsonResult({ indexes, indexStats: stats });
    },
  );
}
