/**
 * @raviraj87/mongodb-mcp · util/bson.ts
 * EJSON parse and serialize utilities.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

import { EJSON } from "bson";

export function parseEjson<T = unknown>(value: string | undefined, fallback: T): T {
  if (value === undefined || value === "") return fallback;
  return EJSON.parse(value, { relaxed: false }) as T;
}

export function serializeEjson(value: unknown): string {
  return EJSON.stringify(value, { relaxed: false });
}

export function estimatePayloadBytes(value: unknown): number {
  return Buffer.byteLength(serializeEjson(value), "utf8");
}
