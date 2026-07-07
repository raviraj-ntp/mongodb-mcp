/**
 * @raviraj87/mongodb-mcp · tools/writeTools.ts
 * Document write and bulk operation MCP tools.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { parseEjson } from "../util/bson.js";
import { assertNoServerSideJs } from "../util/guards.js";
import {
  checkConfirmation,
  checkWrite,
  collectionField,
  confirmedField,
  connectionField,
  dbField,
  jsonResult,
  registerTool,
} from "./common.js";

export function registerWriteTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "insert_many",
    "Insert documents into a collection (EJSON array).",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      documents: z.string().describe("EJSON array of documents"),
    },
    async ({ connection, database, collection, documents }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "insert_many");
      const docs = parseEjson<unknown[]>(documents, []);
      if (!Array.isArray(docs) || !docs.length) throw new Error("documents must be a non-empty array");
      if (settings.disableServerSideJs) assertNoServerSideJs(docs, "documents");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).insertMany(docs as object[]);
      return jsonResult({ insertedCount: result.insertedCount, insertedIds: result.insertedIds });
    },
  );

  registerTool(
    server,
    "update_many",
    "Update documents matching a filter.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().describe("EJSON filter"),
      update: z.string().describe("EJSON update document"),
      upsert: z.boolean().optional(),
      confirmed: confirmedField,
    },
    async ({ connection, database, collection, filter, update, upsert, confirmed }) => {
      checkConfirmation(mgr, "update_many", confirmed);
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "update_many");
      const parsedFilter = parseEjson(filter, {});
      const parsedUpdate = parseEjson(update, {});
      if (settings.disableServerSideJs) {
        assertNoServerSideJs(parsedFilter, "filter");
        assertNoServerSideJs(parsedUpdate, "update");
      }
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).updateMany(parsedFilter, parsedUpdate, { upsert });
      return jsonResult({
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
      });
    },
  );

  registerTool(
    server,
    "delete_many",
    "Delete documents matching a filter.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string().describe("EJSON filter"),
      confirmed: confirmedField,
    },
    async ({ connection, database, collection, filter, confirmed }) => {
      checkConfirmation(mgr, "delete_many", confirmed);
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "delete_many");
      const parsed = parseEjson(filter, {});
      if (settings.disableServerSideJs) assertNoServerSideJs(parsed, "filter");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).deleteMany(parsed);
      return jsonResult({ deletedCount: result.deletedCount });
    },
  );

  registerTool(
    server,
    "bulk_write",
    "Execute bulk write operations.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      operations: z.string().describe("EJSON array of bulk write ops"),
      ordered: z.boolean().optional(),
    },
    async ({ connection, database, collection, operations, ordered }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "bulk_write");
      const ops = parseEjson(operations, []);
      if (settings.disableServerSideJs) assertNoServerSideJs(ops, "operations");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).bulkWrite(ops as any, { ordered: ordered ?? true });
      return jsonResult(result);
    },
  );

  registerTool(
    server,
    "find_one_and_update",
    "Atomically find and update one document.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string(),
      update: z.string(),
      upsert: z.boolean().optional(),
      returnDocument: z.enum(["before", "after"]).optional(),
    },
    async ({ connection, database, collection, filter, update, upsert, returnDocument }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "find_one_and_update");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).findOneAndUpdate(
        parseEjson(filter, {}),
        parseEjson(update, {}),
        { upsert, returnDocument: returnDocument ?? "after" },
      );
      return jsonResult(result);
    },
  );

  registerTool(
    server,
    "find_one_and_delete",
    "Atomically find and delete one document.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string(),
    },
    async ({ connection, database, collection, filter }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "find_one_and_delete");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).findOneAndDelete(parseEjson(filter, {}));
      return jsonResult(result);
    },
  );

  registerTool(
    server,
    "find_one_and_replace",
    "Atomically find and replace one document.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      filter: z.string(),
      replacement: z.string(),
      upsert: z.boolean().optional(),
    },
    async ({ connection, database, collection, filter, replacement, upsert }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "find_one_and_replace");
      const db = await mgr.getDb(connection, database);
      const result = await db.collection(collection).findOneAndReplace(
        parseEjson(filter, {}),
        parseEjson(replacement, {}),
        { upsert },
      );
      return jsonResult(result);
    },
  );
}
