/**
 * @raviraj87/mongodb-mcp · tools/adminTools.ts
 * Collection, index, and database admin MCP tools.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connectionManager.js";
import { parseEjson } from "../util/bson.js";
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

export function registerAdminTools(server: McpServer, mgr: ConnectionManager): void {
  registerTool(
    server,
    "create_collection",
    "Create a new collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      options: z.string().optional().describe("EJSON collection options"),
    },
    async ({ connection, database, collection, options }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "create_collection");
      const db = await mgr.getDb(connection, database);
      await db.createCollection(collection, parseEjson(options, {}));
      return jsonResult({ created: `${database}.${collection}` });
    },
  );

  registerTool(
    server,
    "drop_collection",
    "Drop a collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      confirmed: confirmedField,
    },
    async ({ connection, database, collection, confirmed }) => {
      checkConfirmation(mgr, "drop_collection", confirmed);
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "drop_collection");
      const db = await mgr.getDb(connection, database);
      const dropped = await db.collection(collection).drop();
      return jsonResult({ dropped });
    },
  );

  registerTool(
    server,
    "rename_collection",
    "Rename a collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      newName: z.string(),
      dropTarget: z.boolean().optional(),
    },
    async ({ connection, database, collection, newName, dropTarget }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "rename_collection");
      const db = await mgr.getDb(connection, database);
      await db.collection(collection).rename(newName, { dropTarget });
      return jsonResult({ from: collection, to: newName });
    },
  );

  registerTool(
    server,
    "create_index",
    "Create an index on a collection.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      keys: z.string().describe("EJSON index key spec, e.g. {\"email\":1}"),
      options: z.string().optional().describe("EJSON index options"),
    },
    async ({ connection, database, collection, keys, options }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "create_index");
      const db = await mgr.getDb(connection, database);
      const name = await db.collection(collection).createIndex(parseEjson(keys, {}), parseEjson(options, {}));
      return jsonResult({ indexName: name });
    },
  );

  registerTool(
    server,
    "drop_index",
    "Drop an index by name.",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      indexName: z.string(),
      confirmed: confirmedField,
    },
    async ({ connection, database, collection, indexName, confirmed }) => {
      checkConfirmation(mgr, "drop_index", confirmed);
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "drop_index");
      const db = await mgr.getDb(connection, database);
      await db.collection(collection).dropIndex(indexName);
      return jsonResult({ dropped: indexName });
    },
  );

  registerTool(
    server,
    "drop_database",
    "Drop an entire database.",
    {
      connection: connectionField,
      database: dbField,
      confirmed: confirmedField,
    },
    async ({ connection, database, confirmed }) => {
      checkConfirmation(mgr, "drop_database", confirmed);
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "drop_database");
      const db = await mgr.getDb(connection, database);
      await db.dropDatabase();
      return jsonResult({ dropped: database });
    },
  );

  registerTool(
    server,
    "coll_mod",
    "Modify collection options (validator, TTL, etc.).",
    {
      connection: connectionField,
      database: dbField,
      collection: collectionField,
      options: z.string().describe("EJSON collMod options"),
    },
    async ({ connection, database, collection, options }) => {
      const settings = mgr.settingsFor(connection);
      checkWrite(settings, "coll_mod");
      const db = await mgr.getDb(connection, database);
      return jsonResult(await db.command({ collMod: collection, ...parseEjson(options, {}) }));
    },
  );
}
