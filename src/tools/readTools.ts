/**
 * @raviraj87/mongodb-mcp · tools/readTools.ts
 * Read and query MCP tools (find, aggregate, count).
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Document } from "mongodb";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { estimatePayloadBytes, parseEjson, serializeEjson } from "../util/bson.js";
import { assertNoServerSideJs, assertUsesIndex } from "../util/guards.js";
import { truncateText } from "../util/response.js";
import {
  collectionField,
  connectionField,
  dbField,
  jsonResult,
  registerTool,
} from "./common.js";

export function registerReadTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "find",
    "Run a find query against a collection. Returns EJSON documents.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().optional().describe("EJSON filter (default {})"),
      projection: z.string().optional().describe("EJSON projection"),
      sort: z.string().optional().describe("EJSON sort"),
      limit: z.number().optional(),
      skip: z.number().optional(),
    },
    async ({ connection, database, collection, filter, projection, sort, limit, skip }) => {
      const settings = mgr.settingsFor(connection);
      const parsedFilter = parseEjson(filter, {});
      const parsedProjection = parseEjson(projection, undefined);
      const parsedSort = parseEjson(sort, undefined);
      if (settings.disableServerSideJs) {
        assertNoServerSideJs(parsedFilter, "filter");
        assertNoServerSideJs(parsedProjection, "projection");
      }

      const db = await mgr.getDb(connection, database);
      const coll = db.collection(collection);
      const max = Math.min(limit ?? settings.maxDocumentsPerQuery, settings.maxDocumentsPerQuery);

      if (settings.indexCheck) {
        await assertUsesIndex(() =>
          coll.find(parsedFilter, { projection: parsedProjection, sort: parsedSort }).limit(1).explain("executionStats") as Promise<Record<string, unknown>>,
        );
      }

      const cursor = coll.find(parsedFilter, { projection: parsedProjection, sort: parsedSort });
      if (skip) cursor.skip(skip);
      const docs = await cursor.limit(max).toArray();
      const payload = docs.map((d) => parseEjson(serializeEjson(d), d));
      if (estimatePayloadBytes(payload) > settings.maxPayloadBytes) {
        throw new Error("Result exceeds max_payload_bytes; reduce limit or add projection");
      }
      return jsonResult({ count: docs.length, documents: payload });
    },
  );

  registerTool(
    server,
    "find_one",
    "Find a single document.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().optional(),
      projection: z.string().optional(),
      sort: z.string().optional(),
    },
    async ({ connection, database, collection, filter, projection, sort }) => {
      const settings = mgr.settingsFor(connection);
      const parsedFilter = parseEjson(filter, {});
      const parsedProjection = parseEjson(projection, undefined);
      const parsedSort = parseEjson(sort, undefined);
      if (settings.disableServerSideJs) assertNoServerSideJs(parsedFilter, "filter");
      const db = await mgr.getDb(connection, database);
      const doc = await db
        .collection(collection)
        .findOne(parsedFilter, { projection: parsedProjection, sort: parsedSort });
      return jsonResult(doc ? parseEjson(serializeEjson(doc), doc) : null);
    },
  );

  registerTool(
    server,
    "aggregate",
    "Run an aggregation pipeline on a collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      pipeline: z.string().describe("EJSON aggregation pipeline array"),
    },
    async ({ connection, database, collection, pipeline }) => {
      const settings = mgr.settingsFor(connection);
      const stages = parseEjson<Document[]>(pipeline, []);
      if (!Array.isArray(stages)) throw new Error("pipeline must be a JSON array");
      if (settings.disableServerSideJs) assertNoServerSideJs(stages, "pipeline");
      const db = await mgr.getDb(connection, database);
      const docs = await db
        .collection(collection)
        .aggregate(stages, { allowDiskUse: true })
        .limit(settings.maxDocumentsPerQuery)
        .toArray();
      return jsonResult({ count: docs.length, documents: docs.map((d) => parseEjson(serializeEjson(d), d)) });
    },
  );

  registerTool(
    server,
    "aggregate_db",
    "Run a database-level aggregation (e.g. $currentOp, $listLocalSessions).",
    {
      connection: connectionField,
      database: dbField,
      pipeline: z.string().describe("EJSON pipeline array"),
    },
    async ({ connection, database, pipeline }) => {
      const settings = mgr.settingsFor(connection);
      const stages = parseEjson<Document[]>(pipeline, []);
      if (!Array.isArray(stages)) throw new Error("pipeline must be a JSON array");
      if (settings.disableServerSideJs) assertNoServerSideJs(stages, "pipeline");
      const db = await mgr.getDb(connection, database);
      const docs = await db.aggregate(stages).limit(settings.maxDocumentsPerQuery).toArray();
      return jsonResult({ count: docs.length, documents: docs });
    },
  );

  registerTool(
    server,
    "count",
    "Count documents matching a filter.",
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
      const count = await db.collection(collection).countDocuments(parsed);
      return jsonResult({ count });
    },
  );

  registerTool(
    server,
    "explain",
    "Explain a find query execution plan.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().optional(),
      verbosity: z.enum(["queryPlanner", "executionStats", "allPlansExecution"]).optional(),
    },
    async ({ connection, database, collection, filter, verbosity }) => {
      const settings = mgr.settingsFor(connection);
      const parsed = parseEjson(filter, {});
      if (settings.disableServerSideJs) assertNoServerSideJs(parsed, "filter");
      const db = await mgr.getDb(connection, database);
      const plan = await db
        .collection(collection)
        .find(parsed)
        .explain(verbosity ?? "executionStats");
      return jsonResult(plan);
    },
  );

  registerTool(
    server,
    "sample_documents",
    "Random sample of documents from a collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      size: z.number().optional().default(10),
    },
    async ({ connection, database, collection, size }) => {
      const settings = mgr.settingsFor(connection);
      const n = Math.min(size ?? 10, settings.maxDocumentsPerQuery);
      const db = await mgr.getDb(connection, database);
      const docs = await db.collection(collection).aggregate([{ $sample: { size: n } }]).toArray();
      return jsonResult(docs.map((d) => parseEjson(serializeEjson(d), d)));
    },
  );

  registerTool(
    server,
    "text_search",
    "Full-text search (requires text index on collection).",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      search: z.string(),
      limit: z.number().optional(),
    },
    async ({ connection, database, collection, search, limit }) => {
      const settings = mgr.settingsFor(connection);
      const db = await mgr.getDb(connection, database);
      const docs = await db
        .collection(collection)
        .find({ $text: { $search: search } })
        .project({ score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .limit(Math.min(limit ?? 20, settings.maxDocumentsPerQuery))
        .toArray();
      return jsonResult(docs);
    },
  );

  registerTool(
    server,
    "export_query",
    "Export find/aggregate results to a named export (retrievable via exported-data resource).",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      exportName: z.string(),
      mode: z.enum(["find", "aggregate"]).default("find"),
      filter: z.string().optional(),
      pipeline: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ connection, database, collection, exportName, mode, filter, pipeline, limit }) => {
      const settings = mgr.settingsFor(connection);
      const db = await mgr.getDb(connection, database);
      const max = Math.min(limit ?? settings.maxDocumentsPerQuery, settings.maxDocumentsPerQuery);
      let docs;
      if (mode === "aggregate") {
        const stages = parseEjson<Document[]>(pipeline, []);
        docs = await db.collection(collection).aggregate(stages).limit(max).toArray();
      } else {
        const parsed = parseEjson(filter, {});
        docs = await db.collection(collection).find(parsed).limit(max).toArray();
      }
      const { exportStore } = await import("../util/exports.js");
      exportStore.set(exportName, docs);
      return jsonResult({
        exportName,
        documentCount: docs.length,
        resourceUri: `exported-data://${exportName}`,
        preview: truncateText(serializeEjson(docs.slice(0, 3)), 4000),
      });
    },
  );
}
